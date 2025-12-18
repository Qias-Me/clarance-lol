import pytest

from src.core.types import (
    Coordinates,
    CSSCoordinates,
    DetectedField,
    FieldHierarchy,
    FieldType,
    PageInfo,
)
from src.organization.css_converter import CSSConverter
from src.organization.hierarchy import HierarchyBuilder
from src.organization.render_order import RenderOrderCalculator


class TestCSSConverter:
    """
    Tests for CSSConverter class.
    """

    def test_basic_conversion(self):
        """
        Test basic coordinate to CSS conversion.
        """
        converter = CSSConverter()

        coords = Coordinates(x=100.0, y=200.0, width=150.0, height=25.0)
        css = converter.convert(coords, page_width=612.0, page_height=792.0)

        assert isinstance(css, CSSCoordinates)
        assert 0 <= css.left <= 100
        assert 0 <= css.top <= 100
        assert 0 <= css.width <= 100
        assert 0 <= css.height <= 100

    def test_percentage_calculation(self):
        """
        Test percentage calculation accuracy.
        """
        converter = CSSConverter()

        coords = Coordinates(x=306.0, y=396.0, width=306.0, height=396.0)
        css = converter.convert(coords, page_width=612.0, page_height=792.0)

        assert abs(css.left - 50.0) < 0.01
        assert abs(css.top - 50.0) < 0.01
        assert abs(css.width - 50.0) < 0.01
        assert abs(css.height - 50.0) < 0.01

    def test_zero_coordinates(self):
        """
        Test zero coordinate conversion.
        """
        converter = CSSConverter()

        coords = Coordinates(x=0.0, y=0.0, width=100.0, height=50.0)
        css = converter.convert(coords, page_width=1000.0, page_height=1000.0)

        assert css.left == 0.0
        assert css.top == 0.0

    def test_full_page_coordinates(self):
        """
        Test full page coordinate conversion.
        """
        converter = CSSConverter()

        coords = Coordinates(x=0.0, y=0.0, width=612.0, height=792.0)
        css = converter.convert(coords, page_width=612.0, page_height=792.0)

        assert css.left == 0.0
        assert css.top == 0.0
        assert css.width == 100.0
        assert css.height == 100.0


class TestHierarchyBuilder:
    """
    Tests for HierarchyBuilder class.
    """

    def test_single_section(self):
        """
        Test hierarchy with single section.
        """
        builder = HierarchyBuilder()

        fields = [
            DetectedField(
                field_id="field_001",
                field_type=FieldType.TEXT_INPUT,
                coordinates=Coordinates(x=100, y=100, width=150, height=25),
                hierarchy=FieldHierarchy(section="Personal", field_name="name"),
                page_number=1,
                confidence_score=0.95,
            ),
            DetectedField(
                field_id="field_002",
                field_type=FieldType.TEXT_INPUT,
                coordinates=Coordinates(x=100, y=150, width=150, height=25),
                hierarchy=FieldHierarchy(section="Personal", field_name="email"),
                page_number=1,
                confidence_score=0.92,
            ),
        ]

        hierarchy = builder.build_hierarchy(fields)

        assert "Personal" in hierarchy
        assert len(hierarchy["Personal"]["fields"]) == 2

    def test_multiple_sections(self):
        """
        Test hierarchy with multiple sections.
        """
        builder = HierarchyBuilder()

        fields = [
            DetectedField(
                field_id="field_001",
                field_type=FieldType.TEXT_INPUT,
                coordinates=Coordinates(x=100, y=100, width=150, height=25),
                hierarchy=FieldHierarchy(section="Personal", field_name="name"),
                page_number=1,
                confidence_score=0.95,
            ),
            DetectedField(
                field_id="field_002",
                field_type=FieldType.TEXT_INPUT,
                coordinates=Coordinates(x=100, y=300, width=150, height=25),
                hierarchy=FieldHierarchy(section="Employment", field_name="company"),
                page_number=1,
                confidence_score=0.90,
            ),
        ]

        hierarchy = builder.build_hierarchy(fields)

        assert "Personal" in hierarchy
        assert "Employment" in hierarchy


class TestRenderOrderCalculator:
    """
    Tests for RenderOrderCalculator class.
    """

    def test_vertical_ordering(self):
        """
        Test vertical render order calculation.
        """
        calculator = RenderOrderCalculator()

        fields = [
            DetectedField(
                field_id="field_001",
                field_type=FieldType.TEXT_INPUT,
                coordinates=Coordinates(x=100, y=300, width=150, height=25),
                hierarchy=FieldHierarchy(section="Test", field_name="bottom"),
                page_number=1,
                confidence_score=0.95,
            ),
            DetectedField(
                field_id="field_002",
                field_type=FieldType.TEXT_INPUT,
                coordinates=Coordinates(x=100, y=100, width=150, height=25),
                hierarchy=FieldHierarchy(section="Test", field_name="top"),
                page_number=1,
                confidence_score=0.92,
            ),
        ]

        calculator.calculate_order(fields)

        top_field = next(f for f in fields if f.field_id == "field_002")
        bottom_field = next(f for f in fields if f.field_id == "field_001")

        assert top_field.render_order < bottom_field.render_order

    def test_tab_index_assignment(self):
        """
        Test tab index assignment.
        """
        calculator = RenderOrderCalculator()

        fields = [
            DetectedField(
                field_id="field_001",
                field_type=FieldType.TEXT_INPUT,
                coordinates=Coordinates(x=100, y=100, width=150, height=25),
                hierarchy=FieldHierarchy(section="Test", field_name="first"),
                page_number=1,
                confidence_score=0.95,
            ),
            DetectedField(
                field_id="field_002",
                field_type=FieldType.TEXT_INPUT,
                coordinates=Coordinates(x=100, y=200, width=150, height=25),
                hierarchy=FieldHierarchy(section="Test", field_name="second"),
                page_number=1,
                confidence_score=0.92,
            ),
        ]

        calculator.calculate_order(fields)

        assert all(f.tab_index is not None for f in fields)
        assert fields[0].tab_index != fields[1].tab_index
