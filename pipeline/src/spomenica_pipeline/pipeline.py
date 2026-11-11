"""Orchestration: runs every processing step in order."""

import logging
from dataclasses import dataclass
from pathlib import Path

from spomenica_pipeline import color, export, geometry, images
from spomenica_pipeline.config import PipelineConfig
from spomenica_pipeline.geometry import Quad, Size

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class PipelineResult:
    """What the pipeline produced.

    Attributes:
        size: Size of the master image in pixels.
        document_detected: Whether document edges were found (or given) and corrected.
        master: Path of the master TIFF.
        preview: Path of the preview JPEG.
        dzi: Path of the Deep Zoom descriptor.
    """

    size: Size
    document_detected: bool
    master: Path
    preview: Path
    dzi: Path


def find_document(
    config: PipelineConfig, proxy: images.FloatImage, proxy_size: Size
) -> Quad | None:
    """Pick the document quad: manual corners from config, else automatic detection.

    Args:
        config: Pipeline configuration.
        proxy: Rotated analysis proxy.
        proxy_size: Size of ``proxy``.

    Returns:
        Quad in proxy coordinates, or ``None`` to keep the whole frame.
    """
    if config.corners is not None:
        logger.info("Using manual document corners from config")

        return geometry.corners_to_quad(config.corners, proxy_size)

    quad = geometry.detect_document_quad(proxy, config.min_document_area)

    if quad is None:
        logger.warning(
            "No document edges found; keeping the whole frame. "
            "Pass --corners to crop and straighten manually."
        )
    else:
        logger.info("Detected document corners: %s", quad.round(1).tolist())

    return quad


def run(config: PipelineConfig) -> PipelineResult:
    """Run the full pipeline: straighten, color-correct, export, tile.

    Args:
        config: Pipeline configuration.

    Returns:
        Summary of the produced files.
    """
    full = geometry.rotate(images.load_source(config.source_image), config.rotate_degrees)
    full_size = Size(full.width, full.height)
    proxy_vips = images.load_proxy(config.source_image, config.analysis_max_side)
    proxy = images.vips_to_numpy(geometry.rotate(proxy_vips, config.rotate_degrees))
    proxy_size = Size(proxy.shape[1], proxy.shape[0])
    logger.info("Source %dx%d, analysis proxy %dx%d", *_dims(full_size), *_dims(proxy_size))

    full_rgb = images.to_rgb_float(full)
    proxy_quad = find_document(config, proxy, proxy_size)

    if proxy_quad is not None:
        full_quad = geometry.scale_quad(proxy_quad, proxy_size, full_size)
        out_size = geometry.output_size(full_quad)
        proxy_out = Size(
            max(1, round(out_size.width * proxy_size.width / full_size.width)),
            max(1, round(out_size.height * proxy_size.height / full_size.height)),
        )
        proxy = geometry.warp_numpy(proxy, proxy_quad, proxy_out)
        full_rgb = geometry.warp_vips(full_rgb, full_quad, out_size)

    field = color.estimate_paper_field(
        proxy, config.illumination_grid, config.paper_percentile, config.max_gain
    )
    correction = color.ToneCorrection(
        paper_field=field,
        black_point=color.estimate_black_point(proxy, field, config.black_point_percentile),
        paper_tone=config.paper_tone,
    )
    logger.info("Black point %.3f", correction.black_point)
    master = color.apply_tone_vips(full_rgb, correction)
    master_size = Size(master.width, master.height)

    logger.info("Writing master %dx%d -> %s", *_dims(master_size), config.master_path)
    export.save_master(master, config.master_path)
    export.save_preview(config.master_path, config.preview_path, config.preview_max_side)

    logger.info("Writing Deep Zoom tiles -> %s", config.dzi_path)
    dzi = export.save_tiles(
        config.master_path,
        config.tiles_dir,
        config.tiles_name,
        tile_size=config.tile_size,
        overlap=config.tile_overlap,
        quality=config.tile_quality,
        tile_format=config.tile_format,
    )

    return PipelineResult(
        size=master_size,
        document_detected=proxy_quad is not None,
        master=config.master_path,
        preview=config.preview_path,
        dzi=dzi,
    )


def _dims(size: Size) -> tuple[int, int]:
    return size.width, size.height
