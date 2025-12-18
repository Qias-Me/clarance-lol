import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import List

from ..core.types import (
    DetectedField,
    Entry,
    GoldenMap,
    GoldenMapMetadata,
    PageInfo,
    Section,
    Subsection,
)


class GoldenMapGenerator:
    """
    Generates Golden Map JSON output files.

    Creates the primary output document containing all field
    coordinates, hierarchy, and metadata.
    """

    def __init__(self, output_folder: str, project_name: str):
        """
        Initialize golden map generator.

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
        document_name: str,
        pages: List[PageInfo],
        sections: List[Section],
        all_fields: List[DetectedField],
        metadata: GoldenMapMetadata,
    ) -> str:
        """
        Generate and save golden map JSON.

        Args:
            document_id: str
                Unique document identifier.
            document_name: str
                Source PDF filename.
            pages: List[PageInfo]
                Page metadata.
            sections: List[Section]
                Hierarchical sections.
            all_fields: List[DetectedField]
                Flat field list.
            metadata: GoldenMapMetadata
                Document metadata.

        Returns:
            str
                Path to generated file.
        """
        golden_map = GoldenMap(
            document_id=document_id,
            document_name=document_name,
            pages=pages,
            sections=sections,
            all_fields=all_fields,
            coordinate_system="pdf-to-css",
            metadata=metadata,
        )

        output_path = self._output_folder / f"golden-map-{self._project_name}.json"
        self._output_folder.mkdir(parents=True, exist_ok=True)

        json_data = self._serialize_golden_map(golden_map)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)

        return str(output_path)

    def _serialize_golden_map(self, golden_map: GoldenMap) -> dict:
        """
        Serialize golden map to JSON-compatible dict.

        Args:
            golden_map: GoldenMap
                Golden map object.

        Returns:
            dict
                JSON-serializable dictionary.
        """
        return {
            "documentId": golden_map.document_id,
            "documentName": golden_map.document_name,
            "pages": [self._serialize_page(p) for p in golden_map.pages],
            "sections": [self._serialize_section(s) for s in golden_map.sections],
            "allFields": [self._serialize_field(f) for f in golden_map.all_fields],
            "coordinateSystem": golden_map.coordinate_system,
            "metadata": self._serialize_metadata(golden_map.metadata),
        }

    def _serialize_page(self, page: PageInfo) -> dict:
        """
        Serialize page info.

        Args:
            page: PageInfo
                Page metadata.

        Returns:
            dict
                Serialized page.
        """
        return {
            "pageNumber": page.page_number,
            "dimensions": {
                "width": page.width,
                "height": page.height,
            },
        }

    def _serialize_section(self, section: Section) -> dict:
        """
        Serialize section with subsections.

        Args:
            section: Section
                Section object.

        Returns:
            dict
                Serialized section.
        """
        return {
            "sectionId": section.section_id,
            "sectionName": section.section_name,
            "subsections": [self._serialize_subsection(s) for s in section.subsections],
            "fields": [self._serialize_field(f) for f in section.fields],
        }

    def _serialize_subsection(self, subsection: Subsection) -> dict:
        """
        Serialize subsection with entries.

        Args:
            subsection: Subsection
                Subsection object.

        Returns:
            dict
                Serialized subsection.
        """
        return {
            "subsectionId": subsection.subsection_id,
            "subsectionName": subsection.subsection_name,
            "entries": [self._serialize_entry(e) for e in subsection.entries],
            "fields": [self._serialize_field(f) for f in subsection.fields],
        }

    def _serialize_entry(self, entry: Entry) -> dict:
        """
        Serialize entry.

        Args:
            entry: Entry
                Entry object.

        Returns:
            dict
                Serialized entry.
        """
        return {
            "entryId": entry.entry_id,
            "entryName": entry.entry_name,
            "fields": [self._serialize_field(f) for f in entry.fields],
        }

    def _serialize_field(self, field: DetectedField) -> dict:
        """
        Serialize detected field.

        Args:
            field: DetectedField
                Field object.

        Returns:
            dict
                Serialized field.
        """
        result = {
            "fieldId": field.field_id,
            "fieldType": field.field_type.value,
            "coordinates": {
                "x": field.coordinates.x,
                "y": field.coordinates.y,
                "width": field.coordinates.width,
                "height": field.coordinates.height,
            },
            "hierarchy": {
                "section": field.hierarchy.section,
                "subsection": field.hierarchy.subsection,
                "entry": field.hierarchy.entry,
                "fieldLabel": field.hierarchy.field_label,
            },
            "pageNumber": field.page_number,
            "sectionId": field.section_id,
            "renderOrder": field.render_order,
            "confidenceScore": field.confidence_score,
            "sectionClassification": field.hierarchy.section,
            "validationStatus": field.validation_status.value,
        }

        if field.css_coordinates:
            result["cssCoordinates"] = {
                "top": field.css_coordinates.top,
                "left": field.css_coordinates.left,
                "width": field.css_coordinates.width,
                "height": field.css_coordinates.height,
            }

        if field.ui_hints:
            result["uiHints"] = {
                "labelPosition": field.ui_hints.label_position,
                "groupWith": field.ui_hints.group_with,
            }

        return result

    def _serialize_metadata(self, metadata: GoldenMapMetadata) -> dict:
        """
        Serialize metadata.

        Args:
            metadata: GoldenMapMetadata
                Metadata object.

        Returns:
            dict
                Serialized metadata.
        """
        return {
            "createdDate": metadata.created_date,
            "lastValidated": metadata.last_validated,
            "accuracyScore": metadata.accuracy_score,
            "evolutionVersion": metadata.evolution_version,
            "totalFields": metadata.total_fields,
            "totalSections": metadata.total_sections,
            "stepsCompleted": metadata.steps_completed,
            "pdfPath": metadata.pdf_path,
            "sectionsReferencesPath": metadata.sections_references_path,
            "tolerancePixels": metadata.tolerance_pixels,
            "workflowComplete": metadata.workflow_complete,
        }
