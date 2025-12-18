import pytest

from src.core.types import (
    Coordinates,
    CSSCoordinates,
    DetectedField,
    FieldHierarchy,
    FieldType,
    PageInfo,
    ValidationStatus,
)
from src.core.config import GLMConfig, ValidationConfig, ConfigLoader
from src.core.exceptions import PDFLoadError, ValidationError


class TestCoordinates:
    """
    Tests for Coordinates dataclass.
    """

    def test_coordinates_creation(self, sample_coordinates):
        """
        Test coordinate creation from dictionary.

        Args:
            sample_coordinates: dict
                Sample coordinate fixture.
        """
        coords = Coordinates(**sample_coordinates)

        assert coords.x == 100.0
        assert coords.y == 200.0
        assert coords.width == 150.0
        assert coords.height == 25.0

    def test_coordinates_defaults(self):
        """
        Test coordinate default values.
        """
        coords = Coordinates(x=0, y=0, width=100, height=50)

        assert coords.x == 0
        assert coords.y == 0


class TestFieldHierarchy:
    """
    Tests for FieldHierarchy dataclass.
    """

    def test_hierarchy_creation(self, sample_field_hierarchy):
        """
        Test hierarchy creation from dictionary.

        Args:
            sample_field_hierarchy: dict
                Sample hierarchy fixture.
        """
        hierarchy = FieldHierarchy(**sample_field_hierarchy)

        assert hierarchy.section == "Personal Information"
        assert hierarchy.subsection == "Contact Details"
        assert hierarchy.entry is None
        assert hierarchy.field_name == "email_address"

    def test_hierarchy_minimal(self):
        """
        Test hierarchy with minimal fields.
        """
        hierarchy = FieldHierarchy(
            section="Main",
            field_name="test_field",
        )

        assert hierarchy.section == "Main"
        assert hierarchy.subsection is None


class TestDetectedField:
    """
    Tests for DetectedField dataclass.
    """

    def test_field_creation(self, sample_coordinates, sample_field_hierarchy):
        """
        Test detected field creation.

        Args:
            sample_coordinates: dict
                Sample coordinate fixture.
            sample_field_hierarchy: dict
                Sample hierarchy fixture.
        """
        field = DetectedField(
            field_id="field_001",
            field_type=FieldType.TEXT_INPUT,
            coordinates=Coordinates(**sample_coordinates),
            hierarchy=FieldHierarchy(**sample_field_hierarchy),
            page_number=1,
            confidence_score=0.95,
        )

        assert field.field_id == "field_001"
        assert field.field_type == FieldType.TEXT_INPUT
        assert field.page_number == 1
        assert field.confidence_score == 0.95
        assert field.validation_status == ValidationStatus.PENDING

    def test_field_validation_status_update(self, sample_coordinates, sample_field_hierarchy):
        """
        Test field validation status update.

        Args:
            sample_coordinates: dict
                Sample coordinate fixture.
            sample_field_hierarchy: dict
                Sample hierarchy fixture.
        """
        field = DetectedField(
            field_id="field_002",
            field_type=FieldType.CHECKBOX,
            coordinates=Coordinates(**sample_coordinates),
            hierarchy=FieldHierarchy(**sample_field_hierarchy),
            page_number=1,
            confidence_score=0.88,
            validation_status=ValidationStatus.VALIDATED,
        )

        assert field.validation_status == ValidationStatus.VALIDATED


class TestPageInfo:
    """
    Tests for PageInfo dataclass.
    """

    def test_page_info_creation(self):
        """
        Test page info creation.
        """
        page = PageInfo(
            page_number=1,
            width=612.0,
            height=792.0,
            dpi=150,
            rotation=0,
        )

        assert page.page_number == 1
        assert page.width == 612.0
        assert page.height == 792.0
        assert page.dpi == 150


class TestGLMConfig:
    """
    Tests for GLMConfig dataclass.
    """

    def test_config_defaults(self):
        """
        Test GLM config default values.
        """
        config = GLMConfig(
            api_key="test-key",
            api_url="https://api.example.com",
        )

        assert config.api_key == "test-key"
        assert config.max_tokens == 4096
        assert config.temperature == 0.1


class TestValidationConfig:
    """
    Tests for ValidationConfig dataclass.
    """

    def test_validation_config_defaults(self):
        """
        Test validation config defaults.
        """
        config = ValidationConfig()

        assert config.tolerance_pixels == 0.5
        assert config.max_retries == 7
        assert config.confidence_threshold == 0.85


class TestExceptions:
    """
    Tests for custom exceptions.
    """

    def test_pdf_load_error(self):
        """
        Test PDFLoadError creation.
        """
        error = PDFLoadError("/path/to/file.pdf", "File not found")

        assert "file.pdf" in str(error)
        assert "File not found" in str(error)

    def test_validation_error(self):
        """
        Test ValidationError creation.
        """
        error = ValidationError("field_001", "Coordinates out of bounds")

        assert "field_001" in str(error)
        assert "Coordinates out of bounds" in str(error)
