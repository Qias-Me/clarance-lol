import asyncio
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

from ..core.config import DiscoveryConfig
from ..core.types import (
    DetectedField,
    RetryParameters,
    ValidationResult,
    ValidationStatus,
)
from ..vision.base import VisionProvider
from .retry_engine import RetryEngine, RetryResult
from .tolerance import ToleranceChecker


@dataclass
class ValidationProgress:
    """
    Progress information for validation process.

    Attributes:
        total_fields: int
            Total fields to validate.
        validated: int
            Fields validated so far.
        passed: int
            Fields that passed validation.
        failed: int
            Fields currently failing (may retry).
        skipped: int
            Fields skipped after max retries.
        current_accuracy: float
            Current pass rate percentage.
    """

    total_fields: int
    validated: int
    passed: int
    failed: int
    skipped: int
    current_accuracy: float


@dataclass
class ValidationSummary:
    """
    Complete validation summary.

    Attributes:
        total_fields: int
            Total fields validated.
        passed: int
            Fields that passed.
        skipped: int
            Fields skipped to retry pool.
        accuracy: float
            Final accuracy percentage.
        retry_pool_count: int
            Fields in retry pool.
        max_retries_used: int
            Highest retry count used.
    """

    total_fields: int
    passed: int
    skipped: int
    accuracy: float
    retry_pool_count: int
    max_retries_used: int


ProgressCallback = Callable[[ValidationProgress], None]


class ValidationCoordinator:
    """
    Orchestrates the validation process for all fields.

    Manages validation flow including retry logic, progress reporting,
    and final summary generation.
    """

    def __init__(
        self,
        provider: VisionProvider,
        config: DiscoveryConfig,
    ):
        """
        Initialize validation coordinator.

        Args:
            provider: VisionProvider
                Vision provider for coordinate validation.
            config: DiscoveryConfig
                Workflow configuration.
        """
        self._provider = provider
        self._config = config
        self._tolerance_checker = ToleranceChecker(config.validation.tolerance)
        self._retry_engine = RetryEngine(
            max_attempts=config.validation.max_retries,
            parameters=config.retry_parameters,
        )

    async def validate_all_fields(
        self,
        fields: List[DetectedField],
        page_images: Dict[int, bytes],
        progress_callback: Optional[ProgressCallback] = None,
        batch_size: int = 10,
    ) -> tuple[List[DetectedField], ValidationSummary]:
        """
        Validate all detected fields.

        Args:
            fields: List[DetectedField]
                Fields to validate.
            page_images: Dict[int, bytes]
                Mapping of page number to image bytes.
            progress_callback: Optional[ProgressCallback]
                Callback for progress updates.
            batch_size: int
                Number of fields per progress update.

        Returns:
            tuple[List[DetectedField], ValidationSummary]
                Tuple of (validated_fields, summary).
        """
        validated_fields = []
        passed_count = 0
        skipped_count = 0
        max_retries_used = 0

        for idx, field in enumerate(fields):
            result = await self._validate_field_with_retry(
                field=field,
                image_data=page_images[field.page_number],
            )

            validated_fields.append(result.field)
            max_retries_used = max(max_retries_used, result.field.retry_count)

            if result.field.validation_status == ValidationStatus.PASSED:
                passed_count += 1
            elif result.field.validation_status == ValidationStatus.SKIPPED:
                skipped_count += 1
                self._retry_engine.add_to_retry_pool(result.field)

            if progress_callback and (idx + 1) % batch_size == 0:
                accuracy = (passed_count / (idx + 1)) * 100 if idx > 0 else 0
                progress = ValidationProgress(
                    total_fields=len(fields),
                    validated=idx + 1,
                    passed=passed_count,
                    failed=idx + 1 - passed_count - skipped_count,
                    skipped=skipped_count,
                    current_accuracy=accuracy,
                )
                progress_callback(progress)

        accuracy = (passed_count / len(fields)) * 100 if fields else 0

        summary = ValidationSummary(
            total_fields=len(fields),
            passed=passed_count,
            skipped=skipped_count,
            accuracy=accuracy,
            retry_pool_count=self._retry_engine.get_retry_pool_count(),
            max_retries_used=max_retries_used,
        )

        return validated_fields, summary

    async def _validate_field_with_retry(
        self,
        field: DetectedField,
        image_data: bytes,
    ) -> "FieldValidationResult":
        """
        Validate a single field with retry logic.

        Args:
            field: DetectedField
                Field to validate.
            image_data: bytes
                Page image data.

        Returns:
            FieldValidationResult
                Validation result with updated field.
        """
        while self._retry_engine.should_retry(field):
            attempt_num = field.retry_count + 1
            parameters = self._retry_engine.get_parameters_for_attempt(attempt_num)

            passed, measured, difference = await self._provider.validate_coordinates(
                image_data=image_data,
                field=field,
                parameters=parameters,
            )

            field.retry_count = attempt_num
            field.validation_evidence = {
                "attempt": attempt_num,
                "measured": {
                    "x": measured.x,
                    "y": measured.y,
                    "width": measured.width,
                    "height": measured.height,
                },
                "difference": difference,
            }

            if passed:
                field.validation_status = ValidationStatus.PASSED
                return FieldValidationResult(field=field, passed=True)

        if field.validation_status != ValidationStatus.PASSED:
            field.validation_status = ValidationStatus.SKIPPED

        return FieldValidationResult(field=field, passed=False)

    def get_retry_pool(self) -> List[DetectedField]:
        """
        Get fields that failed after max retries.

        Returns:
            List[DetectedField]
                Fields in retry pool.
        """
        return self._retry_engine.get_retry_pool()


@dataclass
class FieldValidationResult:
    """
    Result of validating a single field.

    Attributes:
        field: DetectedField
            The validated field with updated status.
        passed: bool
            Whether validation ultimately passed.
    """

    field: DetectedField
    passed: bool
