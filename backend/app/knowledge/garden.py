"""Knowledge Garden — BM25 search + _candidates promote flow.

Knowledge entries live as markdown files in `knowledge/` with YAML frontmatter.
The garden indexes entries on startup, supports BM25 full-text search, and
provides a _candidates→promote workflow for curating knowledge.
"""

from __future__ import annotations

import math
import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from loguru import logger


# ── BM25 implementation ──


class BM25:
    """Pure-Python BM25 (Okapi) implementation for document retrieval.

    BM25(q, d) = Σ IDF(t) * (tf(t,d) * (k1+1)) / (tf(t,d) + k1 * (1-b + b*|d|/avgdl))
    """

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self._docs: list[list[str]] = []
        self._doc_ids: list[str] = []
        self._avgdl: float = 0.0
        self._df: dict[str, int] = defaultdict(int)  # document frequency
        self._idf: dict[str, float] = {}
        self._N: int = 0

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        """Tokenize text into lowercase terms."""
        return re.findall(r"[\u4e00-\u9fff]|[a-zA-Z0-9]+", text.lower())

    def index(self, doc_id: str, text: str) -> None:
        """Add a document to the index."""
        tokens = self._tokenize(text)
        self._docs.append(tokens)
        self._doc_ids.append(doc_id)

        # Update document frequency
        seen: set[str] = set()
        for t in tokens:
            if t not in seen:
                self._df[t] += 1
                seen.add(t)

        self._N = len(self._docs)
        self._avgdl = sum(len(d) for d in self._docs) / max(self._N, 1)

        # Recompute IDF
        for term, df in self._df.items():
            self._idf[term] = math.log(1 + (self._N - df + 0.5) / (df + 0.5))

    def search(self, query: str, top_k: int = 10) -> list[tuple[str, float]]:
        """Search for documents matching the query, returning (doc_id, score) pairs."""
        if self._N == 0:
            return []

        query_tokens = self._tokenize(query)
        if not query_tokens:
            return []

        scores: list[tuple[str, float]] = []
        for i, doc_tokens in enumerate(self._docs):
            score = 0.0
            doc_len = len(doc_tokens)
            for t in query_tokens:
                if t not in self._idf:
                    continue
                tf = doc_tokens.count(t)
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * doc_len / self._avgdl)
                score += self._idf[t] * numerator / denominator
            scores.append((self._doc_ids[i], score))

        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]


# ── Knowledge Entry ──


@dataclass
class KnowledgeEntry:
    id: str  # filename without .md
    title: str
    content: str
    tags: list[str] = field(default_factory=list)
    category: str = ""
    status: str = "candidate"  # candidate | promoted | archived
    source: str = ""
    raw_meta: dict[str, Any] = field(default_factory=dict)


# ── Knowledge Garden ──


class KnowledgeGarden:
    """Indexes and searches knowledge entries from the knowledge/ directory."""

    def __init__(self, root: Path) -> None:
        self._root = root
        self._bm25 = BM25()
        self._entries: dict[str, KnowledgeEntry] = {}
        self._by_tag: dict[str, list[str]] = defaultdict(list)
        self._by_category: dict[str, list[str]] = defaultdict(list)

    def index_all(self) -> int:
        """Scan knowledge/ directory and index all entries."""
        markdown_dir = self._root / "knowledge"
        if not markdown_dir.is_dir():
            logger.warning(f"Knowledge directory not found: {markdown_dir}")
            return 0

        count = 0
        for mdfile in sorted(markdown_dir.rglob("*.md")):
            try:
                entry = self._load_entry(mdfile)
                self._entries[entry.id] = entry
                text_for_index = f"{entry.title} {entry.content} {' '.join(entry.tags)}"
                self._bm25.index(entry.id, text_for_index)
                for tag in entry.tags:
                    self._by_tag[tag].append(entry.id)
                if entry.category:
                    self._by_category[entry.category].append(entry.id)
                count += 1
            except Exception as e:
                logger.error(f"Failed to index {mdfile.name}: {e}")

        logger.info(f"Knowledge garden indexed {count} entries")
        return count

    def _load_entry(self, path: Path) -> KnowledgeEntry:
        text = path.read_text(encoding="utf-8")
        meta: dict[str, Any] = {}
        content = text

        if text.startswith("---"):
            end = text.find("---", 3)
            if end != -1:
                meta = yaml.safe_load(text[3:end].strip()) or {}
                content = text[end + 3:].strip()

        entry_id = meta.get("id", path.stem)
        return KnowledgeEntry(
            id=entry_id,
            title=meta.get("title", path.stem),
            content=content,
            tags=meta.get("tags", []),
            category=meta.get("category", ""),
            status=meta.get("status", "candidate"),
            source=meta.get("source", ""),
            raw_meta=meta,
        )

    def search(self, query: str, top_k: int = 5) -> list[dict[str, Any]]:
        """Search indexed knowledge and return ranked results."""
        hits = self._bm25.search(query, top_k)
        results: list[dict[str, Any]] = []
        for doc_id, score in hits:
            entry = self._entries.get(doc_id)
            if entry and score > 0:
                results.append({
                    "id": entry.id,
                    "title": entry.title,
                    "score": round(score, 3),
                    "tags": entry.tags,
                    "category": entry.category,
                    "status": entry.status,
                    "snippet": entry.content[:200],
                })
        return results

    def list_by_tag(self, tag: str) -> list[dict[str, Any]]:
        """List entries by tag."""
        ids = self._by_tag.get(tag, [])
        return [{"id": eid, "title": self._entries[eid].title, "status": self._entries[eid].status} for eid in ids if eid in self._entries]

    def list_candidates(self) -> list[dict[str, Any]]:
        """List all entries with status=candidate."""
        return [
            {"id": e.id, "title": e.title, "tags": e.tags, "category": e.category}
            for e in self._entries.values()
            if e.status == "candidate"
        ]

    def list_all(self) -> list[dict[str, Any]]:
        """List all indexed entries (brief with snippet)."""
        return [
            {
                "id": e.id,
                "title": e.title,
                "tags": e.tags,
                "category": e.category,
                "status": e.status,
                "source": e.source,
                "snippet": e.content[:200],
            }
            for e in self._entries.values()
        ]

    def create_entry(self, entry_id: str, title: str, content: str,
                     tags: list[str] | None = None, category: str = "",
                     source: str = "", status: str = "candidate") -> bool:
        """Create a new knowledge entry and write it to knowledge/ directory."""
        markdown_dir = self._root / "knowledge"
        markdown_dir.mkdir(parents=True, exist_ok=True)

        tags = tags or []
        filepath = markdown_dir / f"{entry_id}.md"

        # Build YAML frontmatter + content
        frontmatter = {
            "id": entry_id,
            "title": title,
            "tags": tags,
            "category": category,
            "status": status,
            "source": source,
        }
        yaml_str = yaml.dump(frontmatter, allow_unicode=True, default_flow_style=False)
        file_content = f"---\n{yaml_str}---\n\n{content}"
        filepath.write_text(file_content, encoding="utf-8")

        # Index immediately
        entry = KnowledgeEntry(
            id=entry_id, title=title, content=content,
            tags=tags, category=category, status=status, source=source,
        )
        self._entries[entry_id] = entry
        text_for_index = f"{title} {content} {' '.join(tags)}"
        self._bm25.index(entry_id, text_for_index)
        for tag in tags:
            self._by_tag[tag].append(entry_id)
        if category:
            self._by_category[category].append(entry_id)

        logger.info(f"Knowledge entry created: {entry_id}")
        return True

    def delete_entry(self, entry_id: str) -> bool:
        """Delete a knowledge entry (file + index)."""
        entry = self._entries.pop(entry_id, None)
        if entry is None:
            return False

        # Remove markdown file
        filepath = self._root / "knowledge" / f"{entry_id}.md"
        if filepath.exists():
            filepath.unlink()

        # Clean up tag/category indexes
        for tag in entry.tags:
            if entry_id in self._by_tag[tag]:
                self._by_tag[tag].remove(entry_id)
        if entry.category and entry_id in self._by_category[entry.category]:
            self._by_category[entry.category].remove(entry_id)

        logger.info(f"Knowledge entry deleted: {entry_id}")
        return True

    def promote(self, entry_id: str) -> bool:
        """Promote a candidate knowledge entry."""
        entry = self._entries.get(entry_id)
        if entry is None:
            return False
        if entry.status != "candidate":
            logger.warning(f"Entry {entry_id} is not a candidate (current: {entry.status})")
            return False
        entry.status = "promoted"
        logger.info(f"Knowledge entry promoted: {entry_id}")
        return True

    def get_entry(self, entry_id: str) -> dict[str, Any] | None:
        """Get full details of a knowledge entry."""
        entry = self._entries.get(entry_id)
        if entry is None:
            return None
        return {
            "id": entry.id,
            "title": entry.title,
            "content": entry.content,
            "tags": entry.tags,
            "category": entry.category,
            "status": entry.status,
            "source": entry.source,
        }

    @property
    def stats(self) -> dict[str, Any]:
        total = len(self._entries)
        promoted = sum(1 for e in self._entries.values() if e.status == "promoted")
        candidates = sum(1 for e in self._entries.values() if e.status == "candidate")
        return {
            "total": total,
            "promoted": promoted,
            "candidates": candidates,
            "tags": len(self._by_tag),
            "categories": len(self._by_category),
        }


# Global garden — initialized on startup
garden: KnowledgeGarden | None = None


def get_garden(root: Path | None = None) -> KnowledgeGarden:
    """Get or create the global knowledge garden."""
    global garden
    if garden is None:
        if root is None:
            root = Path(__file__).parent.parent.parent
        garden = KnowledgeGarden(root)
    return garden
