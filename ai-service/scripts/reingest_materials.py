"""Re-ingest every material currently in Qdrant using the fixed parser/chunker.

Scrolls the collection, groups points by material_id, rebuilds each material
from its stored payload metadata (source URL, school/class/section, subject,
chapter, topic), then re-downloads, re-parses, re-chunks, re-embeds and
replaces the old points.

Run from the ai-service root: .venv/bin/python scripts/reingest_materials.py
"""

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.core.qdrant import make_qdrant_client
from app.modules.documents.service import ingest_material

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("reingest")


def collect_materials() -> dict[str, dict]:
    client = make_qdrant_client()
    materials: dict[str, dict] = {}
    offset = None
    while True:
        points, offset = client.scroll(
            collection_name=settings.qdrant_collection,
            limit=200,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for point in points:
            payload = point.payload or {}
            material_id = payload.get("material_id")
            source_id = payload.get("source_id", "")
            if not material_id or ":http" not in source_id:
                continue
            existing = materials.setdefault(material_id, payload)
            if not existing.get("source_name") and payload.get("source_name"):
                materials[material_id] = payload
        if offset is None:
            break
    return materials


def main() -> None:
    materials = collect_materials()
    logger.info("Found %d materials to re-ingest", len(materials))

    failures = []
    for material_id, payload in materials.items():
        url = payload["source_id"].split(":", 1)[1]
        file_name = payload.get("source_name") or Path(url).name
        try:
            indexed, document_type = ingest_material(
                url=url,
                material_id=material_id,
                source_id=payload["source_id"],
                file_name=file_name,
                content_type="",
                replace_existing=True,
                school_id=payload.get("school_id", ""),
                class_id=payload.get("class_id", ""),
                section_id=payload.get("section_id", ""),
                subject_name=payload.get("subject_name", ""),
                chapter_id=payload.get("chapter_id", ""),
                chapter_title=payload.get("chapter_title", ""),
                topic_title=payload.get("topic_title", ""),
            )
            logger.info("Re-ingested %s (%s): %d chunks (%s)", material_id, file_name, indexed, document_type)
        except Exception as exc:
            failures.append((material_id, file_name, str(exc)))
            logger.error("Failed %s (%s): %s", material_id, file_name, exc)

    logger.info("Done: %d ok, %d failed", len(materials) - len(failures), len(failures))
    for material_id, file_name, error in failures:
        logger.error("FAILED %s (%s): %s", material_id, file_name, error)


if __name__ == "__main__":
    main()
