from collections import defaultdict
from typing import Dict, List, Optional
import uuid

from ..core.types import (
    DetectedField,
    Entry,
    Section,
    Subsection,
)


class HierarchyBuilder:
    """
    Builds hierarchical section structure from flat field list.

    Organizes fields into Section -> Subsection -> Entry -> Field
    structure for UI-friendly rendering.
    """

    def __init__(self):
        """
        Initialize hierarchy builder.
        """
        self._sections: Dict[str, Section] = {}

    def build_hierarchy(
        self,
        fields: List[DetectedField],
    ) -> List[Section]:
        """
        Build complete hierarchy from field list.

        Args:
            fields: List[DetectedField]
                Flat list of detected fields.

        Returns:
            List[Section]
                Hierarchically organized sections.
        """
        self._sections.clear()

        section_fields: Dict[str, List[DetectedField]] = defaultdict(list)
        for field in fields:
            section_name = field.hierarchy.section
            section_fields[section_name].append(field)

        for section_name, section_field_list in section_fields.items():
            section = self._build_section(section_name, section_field_list)
            self._sections[section.section_id] = section

        return list(self._sections.values())

    def _build_section(
        self,
        section_name: str,
        fields: List[DetectedField],
    ) -> Section:
        """
        Build a single section with subsections.

        Args:
            section_name: str
                Name of the section.
            fields: List[DetectedField]
                Fields belonging to this section.

        Returns:
            Section
                Constructed section object.
        """
        section_id = f"sec_{uuid.uuid4().hex[:8]}"

        subsection_fields: Dict[Optional[str], List[DetectedField]] = defaultdict(list)
        for field in fields:
            subsection_name = field.hierarchy.subsection
            subsection_fields[subsection_name].append(field)

        subsections = []
        direct_fields = []

        for subsection_name, sub_field_list in subsection_fields.items():
            if subsection_name is None:
                direct_fields.extend(sub_field_list)
            else:
                subsection = self._build_subsection(subsection_name, sub_field_list)
                subsections.append(subsection)

        for field in fields:
            field.section_id = section_id

        return Section(
            section_id=section_id,
            section_name=section_name,
            subsections=subsections,
            fields=direct_fields,
        )

    def _build_subsection(
        self,
        subsection_name: str,
        fields: List[DetectedField],
    ) -> Subsection:
        """
        Build a single subsection with entries.

        Args:
            subsection_name: str
                Name of the subsection.
            fields: List[DetectedField]
                Fields belonging to this subsection.

        Returns:
            Subsection
                Constructed subsection object.
        """
        subsection_id = f"subsec_{uuid.uuid4().hex[:8]}"

        entry_fields: Dict[Optional[str], List[DetectedField]] = defaultdict(list)
        for field in fields:
            entry_name = field.hierarchy.entry
            entry_fields[entry_name].append(field)

        entries = []
        direct_fields = []

        for entry_name, entry_field_list in entry_fields.items():
            if entry_name is None:
                direct_fields.extend(entry_field_list)
            else:
                entry = self._build_entry(entry_name, entry_field_list)
                entries.append(entry)

        return Subsection(
            subsection_id=subsection_id,
            subsection_name=subsection_name,
            entries=entries,
            fields=direct_fields,
        )

    def _build_entry(
        self,
        entry_name: str,
        fields: List[DetectedField],
    ) -> Entry:
        """
        Build a single entry.

        Args:
            entry_name: str
                Name of the entry.
            fields: List[DetectedField]
                Fields belonging to this entry.

        Returns:
            Entry
                Constructed entry object.
        """
        entry_id = f"entry_{uuid.uuid4().hex[:8]}"

        return Entry(
            entry_id=entry_id,
            entry_name=entry_name,
            fields=fields,
        )

    def get_section_count(self) -> int:
        """
        Get count of sections built.

        Returns:
            int
                Number of sections.
        """
        return len(self._sections)

    def get_section_by_id(self, section_id: str) -> Optional[Section]:
        """
        Get section by ID.

        Args:
            section_id: str
                Section identifier.

        Returns:
            Optional[Section]
                Section if found, None otherwise.
        """
        return self._sections.get(section_id)
