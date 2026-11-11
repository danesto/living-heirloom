"""Writing the master image, the preview and the Deep Zoom tiles."""

import shutil
from pathlib import Path

import pyvips


def save_master(image: pyvips.Image, path: Path) -> None:
    """Write the full-resolution master as a tiled, losslessly compressed TIFF.

    This is the point where the lazy pipeline is evaluated; libvips streams it tile by
    tile. BigTIFF allows files over 4 GB.

    Args:
        image: Lazy 8-bit sRGB image.
        path: Output ``.tif`` path; parent directories are created.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    image.tiffsave(
        str(path),
        tile=True,
        tile_width=512,
        tile_height=512,
        compression="deflate",
        predictor="horizontal",
        bigtiff=True,
    )


def save_preview(master: Path, path: Path, max_side: int) -> None:
    """Write a small JPEG preview of the master.

    Args:
        master: Path of the master TIFF.
        path: Output ``.jpg`` path; parent directories are created.
        max_side: Longest side of the preview, in pixels.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    preview = pyvips.Image.thumbnail(str(master), max_side, height=max_side)
    preview.jpegsave(str(path), Q=85, keep="none", optimize_coding=True)


def save_tiles(  # noqa: PLR0913 - mirrors the dzsave options one-to-one
    master: Path,
    tiles_dir: Path,
    name: str,
    *,
    tile_size: int,
    overlap: int,
    quality: int,
    tile_format: str,
) -> Path:
    """Generate Deep Zoom (DZI) tiles for OpenSeadragon.

    Any previous tiles with the same name are removed first, so stale tiles from an older
    (differently sized) source never linger.

    Args:
        master: Path of the master TIFF (read sequentially).
        tiles_dir: Directory for ``<name>.dzi`` and ``<name>_files/``.
        name: Base name of the tile set.
        tile_size: Tile edge length in pixels.
        overlap: Tile overlap in pixels.
        quality: Tile quality, 1-100.
        tile_format: ``"webp"`` or ``"jpg"``.

    Returns:
        Path of the written ``.dzi`` file.
    """
    tiles_dir.mkdir(parents=True, exist_ok=True)
    dzi_path = tiles_dir / f"{name}.dzi"
    dzi_path.unlink(missing_ok=True)
    shutil.rmtree(tiles_dir / f"{name}_files", ignore_errors=True)

    image = pyvips.Image.new_from_file(str(master), access="sequential")
    image.dzsave(
        str(tiles_dir / name),
        layout="dz",
        tile_size=tile_size,
        overlap=overlap,
        suffix=_tile_suffix(tile_format, quality),
        keep="none",
    )
    # libvips always writes a metadata dump next to the tiles; the viewer never uses it.
    (tiles_dir / f"{name}_files" / "vips-properties.xml").unlink(missing_ok=True)

    return dzi_path


def _tile_suffix(tile_format: str, quality: int) -> str:
    """Return the libvips save options for one tile, e.g. ``.webp[Q=88]``."""
    if tile_format == "jpg":
        return f".jpg[Q={quality},optimize_coding]"

    return f".webp[Q={quality},effort=5,smart_subsample]"
