import io
from dataclasses import dataclass
from typing import List, Optional, Tuple

import fitz
from PIL import Image, ImageEnhance, ImageFilter

from ..core.types import PageInfo


@dataclass
class RenderOptions:
    """
    PDF page rendering options.

    Attributes:
        dpi: int
            Dots per inch for rendering resolution.
        zoom_level: float
            Zoom multiplier applied to base DPI.
        contrast_enhancement: bool
            Whether to apply contrast enhancement.
        edge_detection: bool
            Whether to apply edge detection filter.
        output_format: str
            Image output format (PNG or JPEG).
    """

    dpi: int = 150
    zoom_level: float = 1.0
    contrast_enhancement: bool = False
    edge_detection: bool = False
    output_format: str = "PNG"


class PDFRenderer:
    """
    PDF page to image renderer.

    Converts PDF pages to images with configurable resolution
    and preprocessing options for vision model analysis.
    """

    def __init__(self, document: fitz.Document):
        """
        Initialize renderer with PDF document.

        Args:
            document: fitz.Document
                Loaded PyMuPDF document.
        """
        self._document = document

    def render_page(
        self,
        page_number: int,
        options: Optional[RenderOptions] = None,
    ) -> Tuple[bytes, PageInfo]:
        """
        Render a single page to image bytes.

        Args:
            page_number: int
                One-indexed page number to render.
            options: Optional[RenderOptions]
                Rendering options, uses defaults if not provided.

        Returns:
            Tuple[bytes, PageInfo]
                Tuple of (image_bytes, page_info).
        """
        if options is None:
            options = RenderOptions()

        page_index = page_number - 1
        page = self._document[page_index]

        zoom = (options.dpi / 72.0) * options.zoom_level
        matrix = fitz.Matrix(zoom, zoom)

        pixmap = page.get_pixmap(matrix=matrix)

        image_data = pixmap.tobytes("png")

        if options.contrast_enhancement or options.edge_detection:
            image_data = self._apply_preprocessing(image_data, options)

        page_info = PageInfo(
            page_number=page_number,
            width=page.rect.width,
            height=page.rect.height,
        )

        return image_data, page_info

    def render_all_pages(
        self,
        options: Optional[RenderOptions] = None,
    ) -> List[Tuple[bytes, PageInfo]]:
        """
        Render all pages to image bytes.

        Args:
            options: Optional[RenderOptions]
                Rendering options, uses defaults if not provided.

        Returns:
            List[Tuple[bytes, PageInfo]]
                List of (image_bytes, page_info) tuples.
        """
        results = []
        for page_num in range(1, self._document.page_count + 1):
            image_data, page_info = self.render_page(page_num, options)
            results.append((image_data, page_info))
        return results

    def _apply_preprocessing(
        self,
        image_data: bytes,
        options: RenderOptions,
    ) -> bytes:
        """
        Apply image preprocessing for improved detection.

        Args:
            image_data: bytes
                Raw PNG image data.
            options: RenderOptions
                Preprocessing options.

        Returns:
            bytes
                Processed image data.
        """
        image = Image.open(io.BytesIO(image_data))

        if options.contrast_enhancement:
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(1.5)

        if options.edge_detection:
            image = image.filter(ImageFilter.FIND_EDGES)
            image = image.convert("RGB")

        output = io.BytesIO()
        image.save(output, format=options.output_format)
        return output.getvalue()

    def get_page_dimensions(self, page_number: int) -> Tuple[float, float]:
        """
        Get page dimensions without rendering.

        Args:
            page_number: int
                One-indexed page number.

        Returns:
            Tuple[float, float]
                Tuple of (width, height) in PDF points.
        """
        page_index = page_number - 1
        page = self._document[page_index]
        return page.rect.width, page.rect.height

    def get_all_page_infos(self) -> List[PageInfo]:
        """
        Get page info for all pages without rendering.

        Returns:
            List[PageInfo]
                Page metadata for all pages.
        """
        infos = []
        for page_num in range(1, self._document.page_count + 1):
            width, height = self.get_page_dimensions(page_num)
            infos.append(PageInfo(
                page_number=page_num,
                width=width,
                height=height,
            ))
        return infos
