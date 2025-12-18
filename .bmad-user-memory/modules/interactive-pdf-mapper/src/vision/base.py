from abc import ABC, abstractmethod
from typing import List, Tuple

from ..core.types import Coordinates, DetectedField, RetryParameters


class VisionProvider(ABC):
    """
    Abstract base class for vision model providers.

    Defines the interface for field detection and coordinate validation
    that must be implemented by concrete vision providers.
    """

    @abstractmethod
    async def detect_fields(
        self,
        image_data: bytes,
        page_number: int,
        parameters: RetryParameters,
    ) -> List[DetectedField]:
        """
        Detect form fields in a page image.

        Args:
            image_data: bytes
                Raw image data in PNG or JPEG format.
            page_number: int
                One-indexed page number for field assignment.
            parameters: RetryParameters
                Detection parameters including sensitivity and thresholds.

        Returns:
            List[DetectedField]
                List of detected fields with coordinates and metadata.
        """
        pass

    @abstractmethod
    async def validate_coordinates(
        self,
        image_data: bytes,
        field: DetectedField,
        parameters: RetryParameters,
    ) -> Tuple[bool, Coordinates, float]:
        """
        Validate field coordinates by re-measuring.

        Args:
            image_data: bytes
                Raw image data in PNG or JPEG format.
            field: DetectedField
                Field to validate with original coordinates.
            parameters: RetryParameters
                Validation parameters including tolerance.

        Returns:
            Tuple[bool, Coordinates, float]
                Tuple of (passed, measured_coordinates, difference).
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """
        Check if the vision provider is available and responding.

        Returns:
            bool
                True if provider is healthy, False otherwise.
        """
        pass

    @abstractmethod
    def get_model_version(self) -> str:
        """
        Get the current model version string.

        Returns:
            str
                Model version identifier.
        """
        pass
