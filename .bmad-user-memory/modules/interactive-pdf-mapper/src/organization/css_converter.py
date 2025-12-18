from typing import List

from ..core.types import CSSCoordinates, DetectedField, PageInfo


class CSSConverter:
    """
    Converts PDF coordinates to CSS percentage coordinates.

    Transforms absolute PDF point coordinates into percentage-based
    CSS coordinates for responsive React component positioning.
    """

    def __init__(self, page_infos: List[PageInfo]):
        """
        Initialize CSS converter with page dimensions.

        Args:
            page_infos: List[PageInfo]
                Page metadata with dimensions.
        """
        self._page_dimensions = {
            info.page_number: (info.width, info.height)
            for info in page_infos
        }

    def convert_field(self, field: DetectedField) -> CSSCoordinates:
        """
        Convert a single field's coordinates to CSS.

        Args:
            field: DetectedField
                Field with PDF coordinates.

        Returns:
            CSSCoordinates
                Percentage-based CSS coordinates.
        """
        page_width, page_height = self._page_dimensions.get(
            field.page_number, (612, 792)
        )

        top_pct = (field.coordinates.y / page_height) * 100
        left_pct = (field.coordinates.x / page_width) * 100
        width_pct = (field.coordinates.width / page_width) * 100
        height_pct = (field.coordinates.height / page_height) * 100

        return CSSCoordinates(
            top=f"{top_pct:.4f}%",
            left=f"{left_pct:.4f}%",
            width=f"{width_pct:.4f}%",
            height=f"{height_pct:.4f}%",
        )

    def convert_all_fields(
        self,
        fields: List[DetectedField],
    ) -> List[DetectedField]:
        """
        Convert all fields and update their CSS coordinates.

        Args:
            fields: List[DetectedField]
                Fields to convert.

        Returns:
            List[DetectedField]
                Fields with CSS coordinates populated.
        """
        for field in fields:
            field.css_coordinates = self.convert_field(field)
        return fields

    def get_pixel_coordinates(
        self,
        css_coords: CSSCoordinates,
        page_number: int,
        target_width: int,
        target_height: int,
    ) -> dict:
        """
        Convert CSS percentages back to pixel coordinates.

        Args:
            css_coords: CSSCoordinates
                CSS percentage coordinates.
            page_number: int
                Page number for reference.
            target_width: int
                Target container width in pixels.
            target_height: int
                Target container height in pixels.

        Returns:
            dict
                Pixel coordinates for target dimensions.
        """
        top_pct = float(css_coords.top.rstrip('%'))
        left_pct = float(css_coords.left.rstrip('%'))
        width_pct = float(css_coords.width.rstrip('%'))
        height_pct = float(css_coords.height.rstrip('%'))

        return {
            "top": int((top_pct / 100) * target_height),
            "left": int((left_pct / 100) * target_width),
            "width": int((width_pct / 100) * target_width),
            "height": int((height_pct / 100) * target_height),
        }
