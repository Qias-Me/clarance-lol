# SF-86 Field Integrity Validator
# Validates clarance-f section references for data integrity issues

from typing import Dict, List, Set, Optional
import json
from pathlib import Path

class FieldIntegrityValidator:
    """
    Validates SF-86 field data integrity across sections.

    Critical Issues to Check:
    - Duplicate coordinates
    - Invalid field ID patterns
    - Missing required fields
    - Out-of-bounds coordinates
    - Type inconsistencies
    """

    def __init__(self, sections_path: str):
        self.sections_path = Path(sections_path)
        self.issues = []

    def validate_section(self, section_id: int) -> Dict:
        """Validate a single section for integrity issues"""
        section_file = self.sections_path / f"section-{section_id}.json"

        if not section_file.exists():
            return {"error": f"Section {section_id} not found"}

        with open(section_file) as f:
            section_data = json.load(f)

        validation_results = {
            "section_id": section_id,
            "section_name": section_data.get("metadata", {}).get("sectionName"),
            "total_fields": len(section_data.get("fields", [])),
            "issues": []
        }

        # Check for integrity issues
        fields = section_data.get("fields", [])
        coordinates_seen = set()
        field_names = set()

        for idx, field in enumerate(fields):
            field_issues = []

            # 1. Check coordinate validity
            rect = field.get("rect", {})
            x, y = rect.get("x", 0), rect.get("y", 0)
            width, height = rect.get("width", 0), rect.get("height", 0)

            if x < 0 or y < 0 or width <= 0 or height <= 0:
                field_issues.append("Invalid dimensions")

            # 2. Check for duplicate coordinates
            coord_key = f"{x}_{y}_{width}_{height}"
            if coord_key in coordinates_seen:
                field_issues.append("Duplicate coordinates")
            coordinates_seen.add(coord_key)

            # 3. Check field ID pattern (Section 13 specific)
            field_name = field.get("name", "")
            if section_id == 13:
                if not field_name.startswith("form1[0]"):
                    field_issues.append("Invalid field ID pattern for Section 13")

                # Check for employment-specific patterns
                if "Employment" in validation_results["section_name"]:
                    if "TextField" not in field_name and "Dropdown" not in field_name:
                        field_issues.append("Non-standard field type for employment")

            # 4. Check required properties
            required_props = ["id", "name", "type", "page", "rect"]
            for prop in required_props:
                if prop not in field:
                    field_issues.append(f"Missing property: {prop}")

            if field_issues:
                validation_results["issues"].append({
                    "field_index": idx,
                    "field_name": field_name,
                    "field_id": field.get("id"),
                    "issues": field_issues
                })

        # Calculate integrity score
        total_fields = len(fields)
        fields_with_issues = len(validation_results["issues"])
        integrity_score = max(0, 100 - (fields_with_issues / total_fields * 100)) if total_fields > 0 else 0

        validation_results["integrity_score"] = integrity_score
        validation_results["fields_with_issues"] = fields_with_issues

        # Section 13 specific warnings
        if section_id == 13:
            if integrity_score < 70:
                validation_results["critical_warning"] = "Section 13 has low integrity score"
            if fields_with_issues > 500:  # Half of Section 13 fields
                validation_results["critical_warning"] = "Section 13 requires manual review"

        return validation_results

    def validate_all_sections(self) -> Dict:
        """Validate all sections and generate comprehensive report"""
        report = {
            "validation_date": datetime.now().isoformat(),
            "total_sections": 30,
            "sections": {},
            "critical_sections": [],
            "summary": {}
        }

        total_issues = 0
        low_integrity_sections = []

        for section_id in range(1, 31):
            section_result = self.validate_section(section_id)
            report["sections"][section_id] = section_result

            if section_result.get("critical_warning"):
                report["critical_sections"].append(section_id)

            if section_result.get("integrity_score", 100) < 80:
                low_integrity_sections.append(section_id)

            total_issues += len(section_result.get("issues", []))

        report["summary"] = {
            "total_issues": total_issues,
            "critical_sections_count": len(report["critical_sections"]),
            "low_integrity_sections": low_integrity_sections,
            "recommendations": [
                "Manual review required for critical sections",
                "Consider field remapping for Section 13",
                "Validate field coordinates against actual PDF"
            ]
        }

        return report

    def generate_clean_section_data(self, section_id: int) -> Dict:
        """Generate cleaned field data for a section, filtering out problematic fields"""
        section_file = self.sections_path / f"section-{section_id}.json"

        with open(section_file) as f:
            section_data = json.load(f)

        validation = self.validate_section(section_id)
        problematic_indices = {issue["field_index"] for issue in validation.get("issues", [])}

        # Filter out problematic fields
        clean_fields = []
        for idx, field in enumerate(section_data.get("fields", [])):
            if idx not in problematic_indices:
                clean_fields.append(field)

        # Add cleaning metadata
        section_data["fields"] = clean_fields
        section_data["metadata"]["original_field_count"] = len(section_data.get("fields", []))
        section_data["metadata"]["filtered_field_count"] = len(clean_fields)
        section_data["metadata"]["issues_filtered"] = len(problematic_indices)

        return section_data