from dataclasses import dataclass
from typing import Dict, List, Optional

from ..core.types import DetectedField, RetryParameters, ValidationStatus


@dataclass
class RetryAttempt:
    """
    Record of a single retry attempt.

    Attributes:
        attempt_number: int
            Which attempt this was (1-7).
        parameters: RetryParameters
            Parameters used for this attempt.
        passed: bool
            Whether validation passed.
        difference: float
            Coordinate difference measured.
    """

    attempt_number: int
    parameters: RetryParameters
    passed: bool
    difference: float


@dataclass
class RetryResult:
    """
    Complete result of retry process for a field.

    Attributes:
        field_id: str
            Identifier of the field.
        final_status: ValidationStatus
            Final validation status.
        attempts: List[RetryAttempt]
            All retry attempts made.
        final_difference: float
            Difference on final attempt.
        skipped: bool
            Whether field was skipped after max retries.
    """

    field_id: str
    final_status: ValidationStatus
    attempts: List[RetryAttempt]
    final_difference: float
    skipped: bool


class RetryEngine:
    """
    Manages retry logic with progressive parameter adjustment.

    Handles the retry process for fields that fail initial validation,
    adjusting parameters on each attempt to improve detection.
    """

    def __init__(
        self,
        max_attempts: int,
        parameters: Dict[int, RetryParameters],
    ):
        """
        Initialize retry engine.

        Args:
            max_attempts: int
                Maximum number of retry attempts.
            parameters: Dict[int, RetryParameters]
                Parameters for each attempt number.
        """
        self._max_attempts = max_attempts
        self._parameters = parameters
        self._retry_pool: List[DetectedField] = []

    def get_parameters_for_attempt(self, attempt: int) -> RetryParameters:
        """
        Get parameters for a specific attempt number.

        Args:
            attempt: int
                Attempt number (1-based).

        Returns:
            RetryParameters
                Parameters for this attempt.
        """
        if attempt in self._parameters:
            return self._parameters[attempt]

        return self._parameters.get(
            self._max_attempts,
            RetryParameters(confidence_threshold=0.65, detection_sensitivity=None),
        )

    def should_retry(self, field: DetectedField) -> bool:
        """
        Check if a field should be retried.

        Args:
            field: DetectedField
                Field to check.

        Returns:
            bool
                True if field should be retried.
        """
        return (
            field.validation_status != ValidationStatus.PASSED
            and field.retry_count < self._max_attempts
        )

    def record_attempt(
        self,
        field: DetectedField,
        passed: bool,
        difference: float,
    ) -> RetryAttempt:
        """
        Record a retry attempt for a field.

        Args:
            field: DetectedField
                Field being validated.
            passed: bool
                Whether validation passed.
            difference: float
                Coordinate difference measured.

        Returns:
            RetryAttempt
                Record of this attempt.
        """
        attempt_num = field.retry_count + 1
        parameters = self.get_parameters_for_attempt(attempt_num)

        return RetryAttempt(
            attempt_number=attempt_num,
            parameters=parameters,
            passed=passed,
            difference=difference,
        )

    def add_to_retry_pool(self, field: DetectedField):
        """
        Add a field to the retry pool for future iteration.

        Args:
            field: DetectedField
                Field that failed after max retries.
        """
        field.validation_status = ValidationStatus.SKIPPED
        self._retry_pool.append(field)

    def get_retry_pool(self) -> List[DetectedField]:
        """
        Get all fields in the retry pool.

        Returns:
            List[DetectedField]
                Fields that failed after max retries.
        """
        return self._retry_pool.copy()

    def clear_retry_pool(self):
        """
        Clear the retry pool.
        """
        self._retry_pool.clear()

    def get_retry_pool_count(self) -> int:
        """
        Get count of fields in retry pool.

        Returns:
            int
                Number of fields in retry pool.
        """
        return len(self._retry_pool)

    def get_max_attempts(self) -> int:
        """
        Get maximum retry attempts.

        Returns:
            int
                Maximum attempts allowed.
        """
        return self._max_attempts
