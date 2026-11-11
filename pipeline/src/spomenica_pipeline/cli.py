"""Command-line entry point: ``uv run spomenica-pipeline``."""

import argparse
import logging
import time
from collections.abc import Sequence
from dataclasses import replace
from pathlib import Path

from spomenica_pipeline.config import Corners, PipelineConfig
from spomenica_pipeline.pipeline import run

logger = logging.getLogger(__name__)

_CORNER_VALUES = 8


def parse_corners(text: str) -> Corners:
    """Parse ``"x1,y1,x2,y2,x3,y3,x4,y4"`` (normalized 0-1) into corners.

    Args:
        text: Eight comma-separated numbers: top-left, top-right, bottom-right, bottom-left.

    Returns:
        The corners as four ``(x, y)`` tuples.

    Raises:
        argparse.ArgumentTypeError: If the text is not eight numbers.
    """
    try:
        values = [float(part) for part in text.split(",")]
    except ValueError as error:
        raise argparse.ArgumentTypeError(f"corners must be numbers: {text!r}") from error

    if len(values) != _CORNER_VALUES:
        msg = f"corners need {_CORNER_VALUES} numbers, got {len(values)}"
        raise argparse.ArgumentTypeError(msg)

    x1, y1, x2, y2, x3, y3, x4, y4 = values

    return (x1, y1), (x2, y2), (x3, y3), (x4, y4)


def build_config(argv: Sequence[str] | None = None) -> PipelineConfig:
    """Parse command-line arguments into a pipeline configuration.

    Args:
        argv: Arguments to parse; ``None`` means ``sys.argv[1:]``.

    Returns:
        The default configuration with any CLI overrides applied.
    """
    defaults = PipelineConfig()
    parser = argparse.ArgumentParser(description="Build the master image and Deep Zoom tiles.")
    parser.add_argument(
        "--source", type=Path, default=defaults.source_image, help="input photo or scan"
    )
    parser.add_argument(
        "--rotate",
        type=int,
        choices=[0, 90, 180, 270],
        default=defaults.rotate_degrees,
        help="clockwise rotation that makes the source upright (default: %(default)s)",
    )
    parser.add_argument(
        "--corners",
        type=parse_corners,
        default=None,
        help="manual document corners after rotation, normalized 0-1: "
        "x,y of top-left, top-right, bottom-right, bottom-left",
    )
    args = parser.parse_args(argv)

    source: Path = args.source
    rotate: int = args.rotate
    corners: Corners | None = args.corners

    return replace(defaults, source_image=source.resolve(), rotate_degrees=rotate, corners=corners)


def main(argv: Sequence[str] | None = None) -> int:
    """Run the full pipeline.

    Args:
        argv: Arguments to parse; ``None`` means ``sys.argv[1:]``.

    Returns:
        Process exit code.
    """
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    logging.getLogger("pyvips").setLevel(logging.WARNING)
    config = build_config(argv)

    if not config.source_image.is_file():
        logger.error("Source image not found: %s", config.source_image)

        return 1

    started = time.perf_counter()
    result = run(config)
    logger.info(
        "Done in %.1fs: %dx%d master, tiles at %s",
        time.perf_counter() - started,
        result.size.width,
        result.size.height,
        result.dzi,
    )

    return 0
