"""Run the isolated Ollama vision contract against one local page image.

Usage from ai-service/:
    .venv/bin/python scripts/vision_smoke_test.py /path/to/textbook-page.png
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.modules.vision.client import extract_visual_content


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract structured visual evidence from one local page image."
    )
    parser.add_argument("image", type=Path, help="PNG/JPEG/WebP textbook-page image")
    args = parser.parse_args()

    if not args.image.is_file():
        parser.error(f"image does not exist: {args.image}")

    result = extract_visual_content(args.image.read_bytes())
    print(f"model: {settings.ollama_vision_model}")
    print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
