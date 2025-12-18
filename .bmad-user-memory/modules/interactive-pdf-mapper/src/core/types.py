from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Literal, Optional


class FieldType(Enum):
    """Enumeration of supported form field types."""

    TEXT_INPUT = "text-input"
    SIGNATURE = "signature"
    DATE = "date"
    CHECKBOX = "checkbox"


class ValidationStatus(Enum):
    """Enumeration of field validation states."""

    PENDING = "pending"
    PASSED = "passed"
    SKIPPED = "skipped"


class DetectionSensitivity(Enum):
    """Enumeration of GLM4.6v detection sensitivity levels."""

    NORMAL = "normal"
    HIGH = "high"
    VERY_HIGH = "very-high"
    MAXIMUM = "maximum"


@dataclass
class Coordinates:
    """
    PDF coordinate representation for field bounding boxes.

    Attributes:
        x: float
            Horizontal position from left edge in PDF points.
        y: float
            Vertical position from top edge in PDF points.
        width: float
            Width of the bounding box in PDF points.
        height: float
            Height of the bounding box in PDF points.
    """

    x: float
    y: float
    width: float
    height: float


@dataclass
class CSSCoordinates:
    """
    CSS coordinate representation for React component positioning.

    Attributes:
        top: str
            CSS top position as percentage string.
        left: str
            CSS left position as percentage string.
        width: str
            CSS width as percentage string.
        height: str
            CSS height as percentage string.
    """

    top: str
    left: str
    width: str
    height: str


@dataclass
class FieldHierarchy:
    """
    Hierarchical classification of a field within the document structure.

    Attributes:
        section: str
            Primary section identifier.
        subsection: Optional[str]
            Secondary grouping within section.
        entry: Optional[str]
            Entry identifier for repeating field groups.
        field_label: Optional[str]
            Human-readable label extracted from PDF.
    """

    section: str
    subsection: Optional[str] = None
    entry: Optional[str] = None
    field_label: Optional[str] = None


@dataclass
class UIHints:
    """
    UI rendering hints for React component generation.

    Attributes:
        label_position: Literal["above", "left", "inline"]
            Recommended label placement relative to field.
        group_with: List[str]
            Field IDs that should be visually grouped together.
    """

    label_position: Literal["above", "left", "inline"] = "above"
    group_with: List[str] = field(default_factory=list)


@dataclass
class DetectedField:
    """
    Complete field representation with all detection and validation data.

    Attributes:
        field_id: str
            Unique identifier for the field.
        field_type: FieldType
            Classification of the field type.
        coordinates: Coordinates
            PDF coordinate bounding box.
        hierarchy: FieldHierarchy
            Document structure classification.
        page_number: int
            One-indexed page number where field appears.
        confidence_score: float
            GLM4.6v detection confidence between 0.0 and 1.0.
        validation_status: ValidationStatus
            Current validation state.
        section_id: str
            Reference to parent section.
        render_order: int
            Tab navigation sequence number.
        css_coordinates: Optional[CSSCoordinates]
            Converted CSS coordinates for React.
        ui_hints: Optional[UIHints]
            Rendering hints for UI generation.
        retry_count: int
            Number of validation retry attempts.
        validation_evidence: Optional[Dict]
            Measurement data from validation.
    """

    field_id: str
    field_type: FieldType
    coordinates: Coordinates
    hierarchy: FieldHierarchy
    page_number: int
    confidence_score: float
    validation_status: ValidationStatus = ValidationStatus.PENDING
    section_id: str = ""
    render_order: int = 0
    css_coordinates: Optional[CSSCoordinates] = None
    ui_hints: Optional[UIHints] = None
    retry_count: int = 0
    validation_evidence: Optional[Dict] = None


@dataclass
class PageInfo:
    """
    PDF page metadata and dimensions.

    Attributes:
        page_number: int
            One-indexed page number.
        width: float
            Page width in PDF points.
        height: float
            Page height in PDF points.
    """

    page_number: int
    width: float
    height: float


@dataclass
class Section:
    """
    Document section containing organized fields.

    Attributes:
        section_id: str
            Unique section identifier.
        section_name: str
            Human-readable section name.
        subsections: List[Subsection]
            Child subsections.
        fields: List[DetectedField]
            Direct child fields without subsection.
    """

    section_id: str
    section_name: str
    subsections: List["Subsection"] = field(default_factory=list)
    fields: List[DetectedField] = field(default_factory=list)


@dataclass
class Subsection:
    """
    Document subsection within a section.

    Attributes:
        subsection_id: str
            Unique subsection identifier.
        subsection_name: str
            Human-readable subsection name.
        entries: List[Entry]
            Child entries for repeating groups.
        fields: List[DetectedField]
            Direct child fields without entry.
    """

    subsection_id: str
    subsection_name: str
    entries: List["Entry"] = field(default_factory=list)
    fields: List[DetectedField] = field(default_factory=list)


@dataclass
class Entry:
    """
    Repeating field group entry within a subsection.

    Attributes:
        entry_id: str
            Unique entry identifier.
        entry_name: str
            Human-readable entry name.
        fields: List[DetectedField]
            Fields belonging to this entry.
    """

    entry_id: str
    entry_name: str
    fields: List[DetectedField] = field(default_factory=list)


@dataclass
class GoldenMapMetadata:
    """
    Golden map document metadata and workflow state.

    Attributes:
        created_date: str
            ISO format creation timestamp.
        last_validated: Optional[str]
            ISO format last validation timestamp.
        accuracy_score: Optional[float]
            Overall validation accuracy percentage.
        evolution_version: int
            GLM4.6v model evolution tracking version.
        total_fields: int
            Count of all detected fields.
        total_sections: int
            Count of all sections.
        steps_completed: List[int]
            Workflow steps that have been completed.
        pdf_path: str
            Absolute path to source PDF.
        sections_references_path: Optional[str]
            Path to ground truth JSON if provided.
        tolerance_pixels: float
            Coordinate validation tolerance.
        workflow_complete: bool
            Whether all workflow steps finished.
        last_processed_page: int
            Last page processed for continuation.
        retry_pool_count: int
            Fields skipped after max retries.
        cache_id: Optional[str]
            Sidecar cache identifier.
    """

    created_date: str
    last_validated: Optional[str] = None
    accuracy_score: Optional[float] = None
    evolution_version: int = 1
    total_fields: int = 0
    total_sections: int = 0
    steps_completed: List[int] = field(default_factory=list)
    pdf_path: str = ""
    sections_references_path: Optional[str] = None
    tolerance_pixels: float = 0.5
    workflow_complete: bool = False
    last_processed_page: int = 0
    retry_pool_count: int = 0
    cache_id: Optional[str] = None


@dataclass
class GoldenMap:
    """
    Complete golden map document structure.

    Attributes:
        document_id: str
            Unique document identifier.
        document_name: str
            Source PDF filename.
        pages: List[PageInfo]
            Page metadata for all pages.
        sections: List[Section]
            Hierarchically organized sections.
        all_fields: List[DetectedField]
            Flat list of all fields for quick access.
        coordinate_system: str
            Coordinate system identifier.
        metadata: GoldenMapMetadata
            Document and workflow metadata.
    """

    document_id: str
    document_name: str
    pages: List[PageInfo]
    sections: List[Section]
    all_fields: List[DetectedField]
    coordinate_system: str = "pdf-to-css"
    metadata: GoldenMapMetadata = field(default_factory=GoldenMapMetadata)


@dataclass
class RetryParameters:
    """
    Parameters for a single retry attempt.

    Attributes:
        confidence_threshold: float
            Minimum confidence score to accept.
        detection_sensitivity: DetectionSensitivity
            GLM4.6v sensitivity level.
        zoom_level: float
            Image zoom multiplier.
        contrast_enhancement: bool
            Whether to apply contrast enhancement.
        edge_detection: bool
            Whether to apply edge detection preprocessing.
    """

    confidence_threshold: float
    detection_sensitivity: DetectionSensitivity
    zoom_level: float = 1.0
    contrast_enhancement: bool = False
    edge_detection: bool = False


@dataclass
class ValidationResult:
    """
    Result of a field coordinate validation.

    Attributes:
        field_id: str
            Identifier of validated field.
        passed: bool
            Whether validation passed tolerance check.
        measured_coordinates: Coordinates
            Coordinates measured during validation.
        difference: float
            Maximum coordinate difference in pixels.
        attempt_number: int
            Which retry attempt this was.
    """

    field_id: str
    passed: bool
    measured_coordinates: Coordinates
    difference: float
    attempt_number: int
