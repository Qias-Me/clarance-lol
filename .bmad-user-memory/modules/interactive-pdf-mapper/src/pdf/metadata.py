import hashlib
from dataclasses import dataclass
from typing import Optional

import fitz


@dataclass
class PDFMetadata:
    """
    Extracted PDF document metadata.

    Attributes:
        title: Optional[str]
            Document title from metadata.
        author: Optional[str]
            Document author from metadata.
        subject: Optional[str]
            Document subject from metadata.
        creator: Optional[str]
            Application that created the document.
        producer: Optional[str]
            PDF producer application.
        creation_date: Optional[str]
            Document creation date.
        modification_date: Optional[str]
            Last modification date.
        page_count: int
            Total number of pages.
        file_size_bytes: int
            File size in bytes.
        md5_hash: str
            MD5 hash of file contents.
    """

    title: Optional[str]
    author: Optional[str]
    subject: Optional[str]
    creator: Optional[str]
    producer: Optional[str]
    creation_date: Optional[str]
    modification_date: Optional[str]
    page_count: int
    file_size_bytes: int
    md5_hash: str


class PDFMetadataExtractor:
    """
    PDF metadata extraction utility.

    Extracts document metadata and computes file hash
    for cache identification.
    """

    def __init__(self, document: fitz.Document, file_path: str):
        """
        Initialize metadata extractor.

        Args:
            document: fitz.Document
                Loaded PyMuPDF document.
            file_path: str
                Path to the PDF file.
        """
        self._document = document
        self._file_path = file_path

    def extract(self) -> PDFMetadata:
        """
        Extract all metadata from the PDF.

        Returns:
            PDFMetadata
                Extracted metadata object.
        """
        metadata = self._document.metadata

        md5_hash = self._compute_file_hash()
        file_size = self._get_file_size()

        return PDFMetadata(
            title=metadata.get("title") or None,
            author=metadata.get("author") or None,
            subject=metadata.get("subject") or None,
            creator=metadata.get("creator") or None,
            producer=metadata.get("producer") or None,
            creation_date=metadata.get("creationDate") or None,
            modification_date=metadata.get("modDate") or None,
            page_count=self._document.page_count,
            file_size_bytes=file_size,
            md5_hash=md5_hash,
        )

    def _compute_file_hash(self) -> str:
        """
        Compute MD5 hash of the PDF file.

        Returns:
            str
                Hexadecimal MD5 hash string.
        """
        hasher = hashlib.md5()
        with open(self._file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    def _get_file_size(self) -> int:
        """
        Get file size in bytes.

        Returns:
            int
                File size in bytes.
        """
        import os
        return os.path.getsize(self._file_path)

    def get_document_id(self) -> str:
        """
        Generate unique document identifier from hash.

        Returns:
            str
                Document identifier string.
        """
        md5_hash = self._compute_file_hash()
        return f"doc_{md5_hash[:12]}"
