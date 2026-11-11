"""Central pipeline configuration.

Every path, size and tuning knob lives here, so swapping the placeholder photo for the
real scan only means changing ``source_image`` (or passing ``--source`` on the CLI).
"""

from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

type Point = tuple[float, float]
type Corners = tuple[Point, Point, Point, Point]
type Rgb = tuple[int, int, int]


@dataclass(frozen=True, slots=True)
class PipelineConfig:
    """Settings shared by all pipeline steps.

    Attributes:
        source_image: Input photo or scan of the document.
        output_dir: Directory for the master image and preview.
        tiles_dir: Directory the Deep Zoom tiles are written to (served by the site).
        tiles_name: Base name of the ``.dzi`` file and ``_files`` folder.
        rotate_degrees: Clockwise rotation that makes the source upright (0, 90, 180, 270).
        corners: Manual document corners, normalized 0-1 in the *rotated* image, in the
            order top-left, top-right, bottom-right, bottom-left. ``None`` means detect
            automatically (and keep the whole frame if detection fails).
        min_document_area: Smallest detected document, as a fraction of the image area,
            that is accepted as a real document edge.
        analysis_max_side: Longest side of the downscaled proxy used for all analysis
            (edge detection, illumination estimate). Full-resolution pixels are only
            touched by the final libvips operations.
        illumination_grid: Number of cells along the longest side of the grid used to
            estimate the paper color / lighting field.
        paper_percentile: Brightness percentile inside each grid cell treated as "paper".
        max_gain: Upper bound on the brightening applied to the darkest areas, so corner
            vignetting does not turn into amplified noise.
        black_point_percentile: Luminance percentile mapped to black after flat-fielding.
        paper_tone: Target sRGB color of clean paper in the output (aged paper, not white).
        preview_max_side: Longest side of the small preview image, in pixels.
        tile_size: Deep Zoom tile edge length, in pixels.
        tile_overlap: Deep Zoom tile overlap, in pixels.
        tile_quality: Quality of the generated tiles (1-100).
        tile_format: Tile image format: ``"webp"`` (smaller, all current browsers) or
            ``"jpg"`` (maximum compatibility).
    """

    source_image: Path = REPO_ROOT / "source" / "placeholder.jpeg"
    output_dir: Path = REPO_ROOT / "pipeline" / "output"
    tiles_dir: Path = REPO_ROOT / "site" / "public" / "tiles"
    tiles_name: str = "spomenica"
    rotate_degrees: int = 90
    corners: Corners | None = None
    min_document_area: float = 0.2
    analysis_max_side: int = 1600
    illumination_grid: int = 40
    paper_percentile: float = 90.0
    max_gain: float = 6.0
    black_point_percentile: float = 0.5
    paper_tone: Rgb = (236, 226, 204)
    preview_max_side: int = 1600
    tile_size: int = 254
    tile_overlap: int = 1
    tile_quality: int = 88
    tile_format: str = "webp"

    def __post_init__(self) -> None:
        """Validate values that would otherwise fail deep inside a processing step.

        Raises:
            ValueError: If a setting is out of range.
        """
        if self.rotate_degrees not in {0, 90, 180, 270}:
            msg = f"rotate_degrees must be 0, 90, 180 or 270, got {self.rotate_degrees}"
            raise ValueError(msg)

        if not 1 <= self.tile_quality <= 100:
            msg = f"tile_quality must be in 1..100, got {self.tile_quality}"
            raise ValueError(msg)

        if self.tile_size <= 0 or self.preview_max_side <= 0 or self.tile_overlap < 0:
            msg = "tile_size and preview_max_side must be positive, tile_overlap non-negative"
            raise ValueError(msg)

        if self.tile_format not in {"webp", "jpg"}:
            msg = f"tile_format must be 'webp' or 'jpg', got {self.tile_format!r}"
            raise ValueError(msg)

        if self.max_gain < 1.0:
            msg = f"max_gain must be at least 1, got {self.max_gain}"
            raise ValueError(msg)

        if self.corners is not None and not all(
            0.0 <= c <= 1.0 for point in self.corners for c in point
        ):
            msg = "corners must be normalized to 0..1"
            raise ValueError(msg)

    @property
    def master_path(self) -> Path:
        """Path of the full-resolution corrected master image."""
        return self.output_dir / "master.tif"

    @property
    def preview_path(self) -> Path:
        """Path of the small JPEG preview."""
        return self.output_dir / "preview.jpg"

    @property
    def dzi_path(self) -> Path:
        """Path of the Deep Zoom descriptor (``.dzi``) the site loads."""
        return self.tiles_dir / f"{self.tiles_name}.dzi"
