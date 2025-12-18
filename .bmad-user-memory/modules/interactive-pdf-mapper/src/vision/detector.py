import asyncio
from dataclasses import dataclass
from typing import Callable, List, Optional

from ..core.config import DiscoveryConfig
from ..core.types import DetectedField, PageInfo, RetryParameters
from .base import VisionProvider


@dataclass
class DetectionProgress:
    """
    Progress information for field detection.

    Attributes:
        page_number: int
            Current page being processed.
        total_pages: int
            Total number of pages.
        fields_detected: int
            Number of fields detected on current page.
        total_fields: int
            Running total of all fields detected.
        confidence_min: float
            Minimum confidence score on current page.
        confidence_max: float
            Maximum confidence score on current page.
        processing_time_ms: int
            Processing time for current page in milliseconds.
    """

    page_number: int
    total_pages: int
    fields_detected: int
    total_fields: int
    confidence_min: float
    confidence_max: float
    processing_time_ms: int


@dataclass
class DetectionResult:
    """
    Complete result of field detection across all pages.

    Attributes:
        fields: List[DetectedField]
            All detected fields.
        pages: List[PageInfo]
            Page metadata for all pages.
        total_processing_time_ms: int
            Total processing time in milliseconds.
        average_confidence: float
            Average confidence score across all fields.
    """

    fields: List[DetectedField]
    pages: List[PageInfo]
    total_processing_time_ms: int
    average_confidence: float


ProgressCallback = Callable[[DetectionProgress], None]


class FieldDetector:
    """
    Orchestrates field detection across PDF pages.

    Manages the detection process including progress reporting,
    checkpointing, and parameter adjustment.
    """

    def __init__(
        self,
        provider: VisionProvider,
        config: DiscoveryConfig,
    ):
        """
        Initialize field detector.

        Args:
            provider: VisionProvider
                Vision model provider for detection.
            config: DiscoveryConfig
                Workflow configuration.
        """
        self._provider = provider
        self._config = config
        self._semaphore = asyncio.Semaphore(config.glm.max_concurrent_requests)
        self._progress_lock = asyncio.Lock()
        self._completed_pages = 0

    async def _detect_page_with_semaphore(
        self,
        image_data: bytes,
        page_number: int,
        parameters: RetryParameters,
    ) -> tuple:
        """
        Detect fields on a single page with rate limiting.

        Args:
            image_data: bytes
                Page image as bytes.
            page_number: int
                One-indexed page number.
            parameters: RetryParameters
                Detection parameters.

        Returns:
            tuple
                Tuple of (page_number, fields, processing_time_ms).
        """
        async with self._semaphore:
            start_time = asyncio.get_event_loop().time()

            fields = await self._provider.detect_fields(
                image_data=image_data,
                page_number=page_number,
                parameters=parameters,
            )

            end_time = asyncio.get_event_loop().time()
            processing_time_ms = int((end_time - start_time) * 1000)

            return page_number, fields, processing_time_ms

    async def detect_all_pages(
        self,
        page_images: List[bytes],
        page_infos: List[PageInfo],
        progress_callback: Optional[ProgressCallback] = None,
        start_page: int = 1,
    ) -> DetectionResult:
        """
        Detect fields across all PDF pages with parallel processing.

        Args:
            page_images: List[bytes]
                List of page images as bytes.
            page_infos: List[PageInfo]
                Page metadata for each page.
            progress_callback: Optional[ProgressCallback]
                Callback for progress updates.
            start_page: int
                Page number to start from (for continuation).

        Returns:
            DetectionResult
                Complete detection results.
        """
        total_pages = len(page_images)
        self._completed_pages = 0

        parameters = self._config.retry_parameters.get(
            1,
            RetryParameters(
                confidence_threshold=0.95,
                detection_sensitivity=self._config.validation.tolerance,
            ),
        )

        tasks = []
        for idx in range(start_page - 1, total_pages):
            page_number = idx + 1
            image_data = page_images[idx]
            task = self._detect_page_with_semaphore(image_data, page_number, parameters)
            tasks.append(task)

        all_fields: List[DetectedField] = []
        total_time_ms = 0
        results_by_page = {}

        for coro in asyncio.as_completed(tasks):
            page_number, fields, processing_time_ms = await coro
            results_by_page[page_number] = fields
            total_time_ms += processing_time_ms

            async with self._progress_lock:
                self._completed_pages += 1
                current_total = sum(len(f) for f in results_by_page.values())

                if progress_callback:
                    if fields:
                        confidence_scores = [f.confidence_score for f in fields]
                        progress = DetectionProgress(
                            page_number=self._completed_pages,
                            total_pages=total_pages,
                            fields_detected=len(fields),
                            total_fields=current_total,
                            confidence_min=min(confidence_scores),
                            confidence_max=max(confidence_scores),
                            processing_time_ms=processing_time_ms,
                        )
                    else:
                        progress = DetectionProgress(
                            page_number=self._completed_pages,
                            total_pages=total_pages,
                            fields_detected=0,
                            total_fields=current_total,
                            confidence_min=0.0,
                            confidence_max=0.0,
                            processing_time_ms=processing_time_ms,
                        )
                    progress_callback(progress)

        for page_num in sorted(results_by_page.keys()):
            all_fields.extend(results_by_page[page_num])

        avg_confidence = 0.0
        if all_fields:
            avg_confidence = sum(f.confidence_score for f in all_fields) / len(all_fields)

        return DetectionResult(
            fields=all_fields,
            pages=page_infos,
            total_processing_time_ms=total_time_ms,
            average_confidence=avg_confidence,
        )

    async def detect_single_page(
        self,
        image_data: bytes,
        page_number: int,
        parameters: Optional[RetryParameters] = None,
    ) -> List[DetectedField]:
        """
        Detect fields on a single page.

        Args:
            image_data: bytes
                Page image as bytes.
            page_number: int
                One-indexed page number.
            parameters: Optional[RetryParameters]
                Detection parameters, uses defaults if not provided.

        Returns:
            List[DetectedField]
                Detected fields on the page.
        """
        if parameters is None:
            parameters = self._config.retry_parameters.get(
                1,
                RetryParameters(
                    confidence_threshold=0.95,
                    detection_sensitivity=self._config.validation.tolerance,
                ),
            )

        return await self._provider.detect_fields(
            image_data=image_data,
            page_number=page_number,
            parameters=parameters,
        )

    def get_field_type_breakdown(
        self, fields: List[DetectedField]
    ) -> dict:
        """
        Get breakdown of fields by type.

        Args:
            fields: List[DetectedField]
                List of detected fields.

        Returns:
            dict
                Mapping of field type to count.
        """
        breakdown = {}
        for field in fields:
            type_name = field.field_type.value
            breakdown[type_name] = breakdown.get(type_name, 0) + 1
        return breakdown

    def get_section_breakdown(
        self, fields: List[DetectedField]
    ) -> dict:
        """
        Get breakdown of fields by section.

        Args:
            fields: List[DetectedField]
                List of detected fields.

        Returns:
            dict
                Mapping of section name to field count.
        """
        breakdown = {}
        for field in fields:
            section = field.hierarchy.section
            breakdown[section] = breakdown.get(section, 0) + 1
        return breakdown
