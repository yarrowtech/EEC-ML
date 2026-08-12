# Copyright (c) 2026 HouseofMusa and YarrowTech
# All rights reserved. Unauthorized copying, modification, distribution,
# or duplication is prohibited without prior written permission.

"""Re-ingest every material currently in Qdrant using the fixed parser/chunker.

Scrolls the collection, groups points by material and source, rebuilds every
attachment from its stored payload metadata, then re-downloads, re-parses,
re-chunks, re-embeds and replaces the old points without dropping sibling
attachments.

Run from the ai-service root: .venv/bin/python scripts/reingest_materials.py
"""

import logging
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.core.qdrant import make_qdrant_client
from app.modules.documents.service import ingest_material

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("reingest")


def _source_url(payload: dict) -> str:
    stored = str(payload.get("source_url", "")).strip()
    if stored:
        return stored
    source_id = str(payload.get("source_id", ""))
    return source_id.split(":", 1)[1] if ":http" in source_id else ""


def collect_materials() -> dict[str, list[dict]]:
    client = make_qdrant_client()
    materials: dict[str, dict[str, dict]] = {}
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
            if not material_id or not source_id or not _source_url(payload):
                continue
            sources = materials.setdefault(material_id, {})
            existing = sources.get(source_id)
            if not existing or (not existing.get("source_name") and payload.get("source_name")):
                sources[source_id] = payload
        if offset is None:
            break
    return {material_id: list(sources.values()) for material_id, sources in materials.items()}


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-ingest Qdrant teaching-material attachments")
    parser.add_argument("--dry-run", action="store_true", help="List recoverable sources without changing Qdrant")
    parser.add_argument(
        "--material-id",
        action="append",
        default=[],
        help="Re-ingest only this material ID (repeatable); defaults to all materials",
    )
    args = parser.parse_args()
    materials = collect_materials()
    if args.material_id:
        requested = set(args.material_id)
        materials = {key: value for key, value in materials.items() if key in requested}
    logger.info("Found %d materials to re-ingest", len(materials))
    if args.dry_run:
        source_count = sum(len(sources) for sources in materials.values())
        logger.info("Dry run: %d recoverable attachment sources; no vectors changed", source_count)
        return

    failures = []
    successful_sources = 0
    total_sources = sum(len(sources) for sources in materials.values())
    for material_id, sources in materials.items():
        for source_index, payload in enumerate(sources):
            url = _source_url(payload)
            file_name = payload.get("source_name") or Path(url).name
            try:
                indexed, document_type = ingest_material(
                    url=url,
                    material_id=material_id,
                    source_id=payload["source_id"],
                    file_name=file_name,
                    content_type="",
                    replace_existing=source_index == 0,
                    school_id=payload.get("school_id", ""),
                    class_id=payload.get("class_id", ""),
                    section_id=payload.get("section_id", ""),
                    academic_year_id=payload.get("academic_year_id", ""),
                    subject_id=payload.get("subject_id", ""),
                    subject_name=payload.get("subject_name", ""),
                    discipline=payload.get("discipline", ""),
                    curriculum_code=payload.get("curriculum_code", ""),
                    chapter_id=payload.get("chapter_id", ""),
                    chapter_title=payload.get("chapter_title", ""),
                    topic_title=payload.get("topic_title", ""),
                    concepts=payload.get("concepts", []),
                    formulas=payload.get("formulas", []),
                    units=payload.get("units", []),
                )
                successful_sources += 1
                logger.info("Re-ingested %s (%s): %d chunks (%s)", material_id, file_name, indexed, document_type)
            except Exception as exc:
                failures.append((material_id, file_name, str(exc)))
                logger.error("Failed %s (%s): %s", material_id, file_name, exc)

    logger.info("Done: %d sources ok, %d failed (of %d)", successful_sources, len(failures), total_sources)
    for material_id, file_name, error in failures:
        logger.error("FAILED %s (%s): %s", material_id, file_name, error)


if __name__ == "__main__":
    main()
