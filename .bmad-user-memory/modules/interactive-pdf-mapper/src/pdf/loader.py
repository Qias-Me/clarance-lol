from pathlib import Path
from typing import Optional

import fitz

from ..core.exceptions import PDFLoadError


class PDFLoader:
    """
    PDF document loader and validator.

    Handles loading PDF files and validating they are readable
    and contain processable pages.
    """

    def __init__(self, pdf_path: str):
        """
        Initialize PDF loader with file path.

        Args:
            pdf_path: str
                Absolute or relative path to PDF file.
        """
        self._path = Path(pdf_path)
        self._document: Optional[fitz.Document] = None

    def load(self) -> fitz.Document:
        """
        Load and validate the PDF document.

        Returns:
            fitz.Document
                Loaded PyMuPDF document object.

        Raises:
            PDFLoadError
                If file does not exist, is not readable, or is not a valid PDF.
        """
        if not self._path.exists():
            raise PDFLoadError(str(self._path), "File does not exist")

        if not self._path.is_file():
            raise PDFLoadError(str(self._path), "Path is not a file")

        try:
            self._document = fitz.open(str(self._path))
        except Exception as e:
            raise PDFLoadError(str(self._path), f"Failed to open PDF: {e}")

        if self._document.page_count == 0:
            raise PDFLoadError(str(self._path), "PDF contains no pages")

        return self._document

    def get_document(self) -> fitz.Document:
        """
        Get the loaded document, loading if necessary.

        Returns:
            fitz.Document
                Loaded PyMuPDF document object.
        """
        if self._document is None:
            return self.load()
        return self._document

    def get_page_count(self) -> int:
        """
        Get the number of pages in the PDF.

        Returns:
            int
                Total page count.
        """
        doc = self.get_document()
        return doc.page_count

    def get_filename(self) -> str:
        """
        Get the PDF filename without path.

        Returns:
            str
                Filename with extension.
        """
        return self._path.name

    def get_absolute_path(self) -> str:
        """
        Get the absolute path to the PDF.

        Returns:
            str
                Absolute file path.
        """
        return str(self._path.resolve())

    def close(self):
        """
        Close the PDF document and release resources.
        """
        if self._document is not None:
            self._document.close()
            self._document = None

    def __enter__(self):
        """
        Context manager entry.

        Returns:
            PDFLoader
                Self for context manager usage.
        """
        self.load()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """
        Context manager exit, closes document.

        Args:
            exc_type: type
                Exception type if raised.
            exc_val: Exception
                Exception value if raised.
            exc_tb: traceback
                Exception traceback if raised.
        """
        self.close()
