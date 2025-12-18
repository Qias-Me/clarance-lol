from typing import List

from ..core.types import DetectedField, UIHints


class RenderOrderCalculator:
    """
    Calculates render order for tab navigation.

    Determines the logical order for field focus/tab navigation
    based on page position and document structure.
    """

    def calculate_order(
        self,
        fields: List[DetectedField],
    ) -> List[DetectedField]:
        """
        Calculate and assign render order to all fields.

        Args:
            fields: List[DetectedField]
                Fields to order.

        Returns:
            List[DetectedField]
                Fields with render_order assigned.
        """
        sorted_fields = sorted(
            fields,
            key=lambda f: (
                f.page_number,
                f.coordinates.y,
                f.coordinates.x,
            ),
        )

        for idx, field in enumerate(sorted_fields):
            field.render_order = idx + 1

        return sorted_fields

    def assign_ui_hints(
        self,
        fields: List[DetectedField],
    ) -> List[DetectedField]:
        """
        Assign UI hints based on field positions and types.

        Args:
            fields: List[DetectedField]
                Fields to process.

        Returns:
            List[DetectedField]
                Fields with UI hints assigned.
        """
        for field in fields:
            label_position = self._determine_label_position(field)
            group_with = self._find_related_fields(field, fields)

            field.ui_hints = UIHints(
                label_position=label_position,
                group_with=group_with,
            )

        return fields

    def _determine_label_position(
        self,
        field: DetectedField,
    ) -> str:
        """
        Determine optimal label position for a field.

        Args:
            field: DetectedField
                Field to analyze.

        Returns:
            str
                Label position: "above", "left", or "inline".
        """
        if field.coordinates.width > 200:
            return "above"

        if field.coordinates.height < 30:
            return "left"

        return "above"

    def _find_related_fields(
        self,
        field: DetectedField,
        all_fields: List[DetectedField],
    ) -> List[str]:
        """
        Find fields that should be grouped with this field.

        Args:
            field: DetectedField
                Field to find relations for.
            all_fields: List[DetectedField]
                All fields to search.

        Returns:
            List[str]
                IDs of related fields.
        """
        related = []
        proximity_threshold = 50

        for other in all_fields:
            if other.field_id == field.field_id:
                continue

            if other.page_number != field.page_number:
                continue

            if other.hierarchy.entry and other.hierarchy.entry == field.hierarchy.entry:
                related.append(other.field_id)
                continue

            y_diff = abs(other.coordinates.y - field.coordinates.y)
            if y_diff < proximity_threshold:
                related.append(other.field_id)

        return related[:5]
