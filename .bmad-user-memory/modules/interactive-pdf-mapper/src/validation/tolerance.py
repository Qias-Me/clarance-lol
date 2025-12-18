from ..core.types import Coordinates


class ToleranceChecker:
    """
    Coordinate tolerance validation utility.

    Compares measured coordinates against expected coordinates
    within a configurable pixel tolerance.
    """

    def __init__(self, tolerance_pixels: float = 0.5):
        """
        Initialize tolerance checker.

        Args:
            tolerance_pixels: float
                Maximum allowed difference in pixels.
        """
        self._tolerance = tolerance_pixels

    def check(
        self,
        expected: Coordinates,
        measured: Coordinates,
    ) -> tuple[bool, float]:
        """
        Check if measured coordinates are within tolerance.

        Args:
            expected: Coordinates
                Expected coordinate values.
            measured: Coordinates
                Measured coordinate values.

        Returns:
            tuple[bool, float]
                Tuple of (passed, max_difference).
        """
        diff_x = abs(expected.x - measured.x)
        diff_y = abs(expected.y - measured.y)
        diff_width = abs(expected.width - measured.width)
        diff_height = abs(expected.height - measured.height)

        max_diff = max(diff_x, diff_y, diff_width, diff_height)
        passed = max_diff <= self._tolerance

        return passed, max_diff

    def get_detailed_differences(
        self,
        expected: Coordinates,
        measured: Coordinates,
    ) -> dict:
        """
        Get detailed breakdown of coordinate differences.

        Args:
            expected: Coordinates
                Expected coordinate values.
            measured: Coordinates
                Measured coordinate values.

        Returns:
            dict
                Dictionary with individual differences.
        """
        return {
            "x_diff": abs(expected.x - measured.x),
            "y_diff": abs(expected.y - measured.y),
            "width_diff": abs(expected.width - measured.width),
            "height_diff": abs(expected.height - measured.height),
            "tolerance": self._tolerance,
            "x_passed": abs(expected.x - measured.x) <= self._tolerance,
            "y_passed": abs(expected.y - measured.y) <= self._tolerance,
            "width_passed": abs(expected.width - measured.width) <= self._tolerance,
            "height_passed": abs(expected.height - measured.height) <= self._tolerance,
        }

    def set_tolerance(self, tolerance_pixels: float):
        """
        Update the tolerance value.

        Args:
            tolerance_pixels: float
                New tolerance value in pixels.
        """
        self._tolerance = tolerance_pixels

    def get_tolerance(self) -> float:
        """
        Get current tolerance value.

        Returns:
            float
                Current tolerance in pixels.
        """
        return self._tolerance
