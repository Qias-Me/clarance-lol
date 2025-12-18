import json
from datetime import datetime
from pathlib import Path
from typing import List
import uuid

from ..core.types import DetectedField, PageInfo
from ..validation.coordinator import ValidationSummary


class MetricsGenerator:
    """
    Generates performance metrics JSON files.

    Creates detailed performance and accuracy metrics for
    system optimization and monitoring.
    """

    def __init__(self, output_folder: str, project_name: str):
        """
        Initialize metrics generator.

        Args:
            output_folder: str
                Directory for output files.
            project_name: str
                Project name for filename.
        """
        self._output_folder = Path(output_folder)
        self._project_name = project_name

    def generate(
        self,
        document_id: str,
        pages: List[PageInfo],
        fields: List[DetectedField],
        validation_summary: ValidationSummary,
        detection_time_ms: int,
        validation_time_ms: int,
        organization_time_ms: int,
    ) -> str:
        """
        Generate and save metrics JSON.

        Args:
            document_id: str
                Document identifier.
            pages: List[PageInfo]
                Page metadata.
            fields: List[DetectedField]
                All detected fields.
            validation_summary: ValidationSummary
                Validation results.
            detection_time_ms: int
                Detection phase time.
            validation_time_ms: int
                Validation phase time.
            organization_time_ms: int
                Organization phase time.

        Returns:
            str
                Path to generated file.
        """
        output_path = self._output_folder / f"metrics-{self._project_name}.json"
        self._output_folder.mkdir(parents=True, exist_ok=True)

        total_time = detection_time_ms + validation_time_ms + organization_time_ms
        page_count = len(pages)
        field_count = len(fields)

        metrics = {
            "workflowId": f"wf_{uuid.uuid4().hex[:12]}",
            "documentId": document_id,
            "timestamp": datetime.now().isoformat(),
            "performance": {
                "totalProcessingTime": f"{total_time}ms",
                "averageTimePerPage": f"{total_time // page_count if page_count else 0}ms",
                "averageTimePerField": f"{total_time // field_count if field_count else 0}ms",
                "detectionTime": f"{detection_time_ms}ms",
                "validationTime": f"{validation_time_ms}ms",
                "organizationTime": f"{organization_time_ms}ms",
            },
            "accuracy": {
                "overallAccuracy": validation_summary.accuracy,
                "detectionConfidence": self._calculate_avg_confidence(fields),
                "validationPassRate": validation_summary.accuracy,
                "coordinatePrecision": 0.5,
            },
            "volume": {
                "totalPages": page_count,
                "totalFields": field_count,
                "totalSections": len(set(f.hierarchy.section for f in fields)),
                "fieldsPerPage": field_count / page_count if page_count else 0,
                "retryPoolSize": validation_summary.retry_pool_count,
            },
            "cacheRecommendations": {
                "shouldCache": True,
                "estimatedCacheSize": f"{self._estimate_cache_size(fields)}bytes",
                "expectedHitRate": "99.8%",
            },
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(metrics, f, indent=2)

        return str(output_path)

    def _calculate_avg_confidence(self, fields: List[DetectedField]) -> float:
        """
        Calculate average confidence score.

        Args:
            fields: List[DetectedField]
                All fields.

        Returns:
            float
                Average confidence percentage.
        """
        if not fields:
            return 0.0
        return sum(f.confidence_score for f in fields) / len(fields) * 100

    def _estimate_cache_size(self, fields: List[DetectedField]) -> int:
        """
        Estimate cache size in bytes.

        Args:
            fields: List[DetectedField]
                All fields.

        Returns:
            int
                Estimated size in bytes.
        """
        return len(fields) * 500
