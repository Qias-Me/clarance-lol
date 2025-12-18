import pytest

from src.core.types import Coordinates
from src.validation.tolerance import ToleranceChecker


class TestToleranceChecker:
    """
    Tests for ToleranceChecker class.
    """

    def test_exact_match(self):
        """
        Test exact coordinate match.
        """
        checker = ToleranceChecker(tolerance_pixels=0.5)

        original = Coordinates(x=100.0, y=200.0, width=150.0, height=25.0)
        validated = Coordinates(x=100.0, y=200.0, width=150.0, height=25.0)

        assert checker.check(original, validated) is True

    def test_within_tolerance(self):
        """
        Test coordinates within tolerance.
        """
        checker = ToleranceChecker(tolerance_pixels=0.5)

        original = Coordinates(x=100.0, y=200.0, width=150.0, height=25.0)
        validated = Coordinates(x=100.3, y=200.2, width=150.4, height=25.1)

        assert checker.check(original, validated) is True

    def test_outside_tolerance(self):
        """
        Test coordinates outside tolerance.
        """
        checker = ToleranceChecker(tolerance_pixels=0.5)

        original = Coordinates(x=100.0, y=200.0, width=150.0, height=25.0)
        validated = Coordinates(x=101.0, y=200.0, width=150.0, height=25.0)

        assert checker.check(original, validated) is False

    def test_boundary_tolerance(self):
        """
        Test coordinates at exact tolerance boundary.
        """
        checker = ToleranceChecker(tolerance_pixels=0.5)

        original = Coordinates(x=100.0, y=200.0, width=150.0, height=25.0)
        validated = Coordinates(x=100.5, y=200.5, width=150.5, height=25.5)

        assert checker.check(original, validated) is True

    def test_detailed_differences(self):
        """
        Test detailed difference calculation.
        """
        checker = ToleranceChecker(tolerance_pixels=0.5)

        original = Coordinates(x=100.0, y=200.0, width=150.0, height=25.0)
        validated = Coordinates(x=101.0, y=202.0, width=148.0, height=26.0)

        differences = checker.get_detailed_differences(original, validated)

        assert differences["x"] == 1.0
        assert differences["y"] == 2.0
        assert differences["width"] == 2.0
        assert differences["height"] == 1.0

    def test_custom_tolerance(self):
        """
        Test custom tolerance value.
        """
        checker = ToleranceChecker(tolerance_pixels=2.0)

        original = Coordinates(x=100.0, y=200.0, width=150.0, height=25.0)
        validated = Coordinates(x=101.5, y=201.5, width=151.5, height=26.5)

        assert checker.check(original, validated) is True

    def test_negative_difference(self):
        """
        Test negative coordinate differences.
        """
        checker = ToleranceChecker(tolerance_pixels=0.5)

        original = Coordinates(x=100.0, y=200.0, width=150.0, height=25.0)
        validated = Coordinates(x=99.7, y=199.8, width=149.6, height=24.9)

        assert checker.check(original, validated) is True
