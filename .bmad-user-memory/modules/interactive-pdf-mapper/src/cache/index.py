import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class CacheEntry:
    """
    Single cache index entry.

    Attributes:
        cache_id: str
            Unique cache identifier.
        document_hash: str
            MD5 hash of source PDF.
        document_name: str
            Original PDF filename.
        cached_date: str
            ISO format cache timestamp.
        golden_map_path: str
            Path to cached golden map.
        field_count: int
            Number of fields in map.
        accuracy_score: float
            Validation accuracy.
    """

    cache_id: str
    document_hash: str
    document_name: str
    cached_date: str
    golden_map_path: str
    field_count: int
    accuracy_score: float


class CacheIndex:
    """
    Manages cache index for quick lookups.

    Maintains an index of all cached golden maps for
    efficient retrieval and management.
    """

    def __init__(self, cache_folder: str, index_filename: str = "cache-index.json"):
        """
        Initialize cache index.

        Args:
            cache_folder: str
                Path to cache directory.
            index_filename: str
                Name of index file.
        """
        self._cache_folder = Path(cache_folder)
        self._index_path = self._cache_folder / index_filename
        self._entries: Dict[str, CacheEntry] = {}
        self._load_index()

    def _load_index(self):
        """
        Load index from disk.
        """
        if not self._index_path.exists():
            return

        try:
            with open(self._index_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            for entry_data in data.get("entries", []):
                entry = CacheEntry(
                    cache_id=entry_data["cacheId"],
                    document_hash=entry_data["documentHash"],
                    document_name=entry_data["documentName"],
                    cached_date=entry_data["cachedDate"],
                    golden_map_path=entry_data["goldenMapPath"],
                    field_count=entry_data.get("fieldCount", 0),
                    accuracy_score=entry_data.get("accuracyScore", 0.0),
                )
                self._entries[entry.document_hash] = entry
        except Exception:
            self._entries = {}

    def _save_index(self):
        """
        Save index to disk.
        """
        self._cache_folder.mkdir(parents=True, exist_ok=True)

        data = {
            "lastUpdated": datetime.now().isoformat(),
            "entries": [
                {
                    "cacheId": e.cache_id,
                    "documentHash": e.document_hash,
                    "documentName": e.document_name,
                    "cachedDate": e.cached_date,
                    "goldenMapPath": e.golden_map_path,
                    "fieldCount": e.field_count,
                    "accuracyScore": e.accuracy_score,
                }
                for e in self._entries.values()
            ],
        }

        with open(self._index_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def add_entry(
        self,
        cache_id: str,
        document_hash: str,
        document_name: str,
        golden_map_path: str,
        field_count: int,
        accuracy_score: float,
    ):
        """
        Add entry to index.

        Args:
            cache_id: str
                Unique cache identifier.
            document_hash: str
                MD5 hash of source PDF.
            document_name: str
                Original PDF filename.
            golden_map_path: str
                Path to cached golden map.
            field_count: int
                Number of fields.
            accuracy_score: float
                Validation accuracy.
        """
        entry = CacheEntry(
            cache_id=cache_id,
            document_hash=document_hash,
            document_name=document_name,
            cached_date=datetime.now().isoformat(),
            golden_map_path=golden_map_path,
            field_count=field_count,
            accuracy_score=accuracy_score,
        )
        self._entries[document_hash] = entry
        self._save_index()

    def get_entry(self, document_hash: str) -> Optional[CacheEntry]:
        """
        Get entry by document hash.

        Args:
            document_hash: str
                MD5 hash of source PDF.

        Returns:
            Optional[CacheEntry]
                Cache entry or None if not found.
        """
        return self._entries.get(document_hash)

    def remove_entry(self, document_hash: str) -> bool:
        """
        Remove entry from index.

        Args:
            document_hash: str
                MD5 hash of source PDF.

        Returns:
            bool
                True if removed, False if not found.
        """
        if document_hash in self._entries:
            del self._entries[document_hash]
            self._save_index()
            return True
        return False

    def get_all_entries(self) -> List[CacheEntry]:
        """
        Get all cache entries.

        Returns:
            List[CacheEntry]
                All cached entries.
        """
        return list(self._entries.values())

    def get_entry_count(self) -> int:
        """
        Get number of cached entries.

        Returns:
            int
                Entry count.
        """
        return len(self._entries)
