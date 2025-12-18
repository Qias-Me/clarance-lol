import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional
import uuid

from ..core.exceptions import CacheError


class SidecarManager:
    """
    Manages sidecar cache storage for golden maps.

    Handles storing, retrieving, and managing cached golden maps
    for performance optimization.
    """

    def __init__(self, cache_folder: str):
        """
        Initialize sidecar manager.

        Args:
            cache_folder: str
                Path to cache directory.
        """
        self._cache_folder = Path(cache_folder)

    def ensure_cache_directory(self):
        """
        Ensure cache directory exists.
        """
        self._cache_folder.mkdir(parents=True, exist_ok=True)

    def store_golden_map(
        self,
        document_hash: str,
        golden_map_path: str,
    ) -> str:
        """
        Store golden map in cache.

        Args:
            document_hash: str
                MD5 hash of source PDF.
            golden_map_path: str
                Path to golden map JSON file.

        Returns:
            str
                Cache ID for the stored map.

        Raises:
            CacheError
                If storage fails.
        """
        self.ensure_cache_directory()

        cache_id = f"cache_{uuid.uuid4().hex[:12]}"
        cache_path = self._cache_folder / f"{document_hash}.json"

        try:
            shutil.copy2(golden_map_path, cache_path)
        except Exception as e:
            raise CacheError("store", cache_id, str(e))

        return cache_id

    def retrieve_golden_map(
        self,
        document_hash: str,
    ) -> Optional[dict]:
        """
        Retrieve golden map from cache.

        Args:
            document_hash: str
                MD5 hash of source PDF.

        Returns:
            Optional[dict]
                Cached golden map data or None if not found.
        """
        cache_path = self._cache_folder / f"{document_hash}.json"

        if not cache_path.exists():
            return None

        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    def has_cached_map(self, document_hash: str) -> bool:
        """
        Check if golden map is cached.

        Args:
            document_hash: str
                MD5 hash of source PDF.

        Returns:
            bool
                True if cached, False otherwise.
        """
        cache_path = self._cache_folder / f"{document_hash}.json"
        return cache_path.exists()

    def delete_cached_map(self, document_hash: str) -> bool:
        """
        Delete cached golden map.

        Args:
            document_hash: str
                MD5 hash of source PDF.

        Returns:
            bool
                True if deleted, False if not found.
        """
        cache_path = self._cache_folder / f"{document_hash}.json"

        if cache_path.exists():
            cache_path.unlink()
            return True
        return False

    def get_cache_size(self) -> int:
        """
        Get total cache size in bytes.

        Returns:
            int
                Total size of all cached files.
        """
        if not self._cache_folder.exists():
            return 0

        total = 0
        for file_path in self._cache_folder.glob("*.json"):
            total += file_path.stat().st_size
        return total

    def clear_cache(self):
        """
        Clear all cached golden maps.
        """
        if self._cache_folder.exists():
            for file_path in self._cache_folder.glob("*.json"):
                file_path.unlink()
