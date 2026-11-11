"""Color cast, vignette and glare correction by flat-fielding against the paper.

The paper is the only thing in the photo whose true color is (roughly) uniform. We estimate
how the paper *appears* across the image (a smooth "paper field" that captures color cast,
vignetting and broad glare), divide it out, then map clean paper to an aged-paper tone.

Estimation runs on the small proxy; the correction is applied to the full image lazily.
"""

from dataclasses import dataclass

import cv2
import numpy as np
import pyvips

from spomenica_pipeline.config import Rgb
from spomenica_pipeline.images import FloatImage, numpy_to_vips

_LUMA = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
_EPSILON = 1e-4


@dataclass(frozen=True, slots=True)
class ToneCorrection:
    """Parameters of the color correction, estimated once on the proxy.

    Attributes:
        paper_field: Small ``(rows, cols, 3)`` grid with the apparent paper color per cell.
        black_point: Luminance (after flat-fielding) that is mapped to black.
        paper_tone: Output sRGB color for clean paper.
    """

    paper_field: FloatImage
    black_point: float
    paper_tone: Rgb


def estimate_paper_field(
    image: FloatImage, grid: int, percentile: float, max_gain: float
) -> FloatImage:
    """Estimate the apparent paper color across the image.

    In each grid cell the brightest pixels (above ``percentile``) are assumed to be bare
    paper; their mean color is that cell's paper color. Outlier cells (dense ink) are
    removed with a median filter and the field is smoothed.

    Args:
        image: RGB proxy, float 0-1.
        grid: Number of cells along the longest side.
        percentile: Luminance percentile within a cell that counts as paper.
        max_gain: Field values are clamped to at least ``max / max_gain``, which caps how
            much the darkest regions are brightened.

    Returns:
        Float32 field of shape ``(rows, cols, 3)``.
    """
    height, width, _ = image.shape
    cell = max(1, int(np.ceil(max(height, width) / grid)))
    rows, cols = int(np.ceil(height / cell)), int(np.ceil(width / cell))
    luma = image @ _LUMA
    field = np.empty((rows, cols, 3), dtype=np.float32)

    for row in range(rows):
        for col in range(cols):
            window = np.s_[row * cell : (row + 1) * cell, col * cell : (col + 1) * cell]
            cell_luma = luma[window].ravel()
            paper = cell_luma >= np.percentile(cell_luma, percentile)
            field[row, col] = image[window].reshape(-1, 3)[paper].mean(axis=0)

    if min(rows, cols) >= 3:
        field = np.asarray(cv2.medianBlur(field, 3), dtype=np.float32)

    field = np.asarray(cv2.GaussianBlur(field, (0, 0), 1.0), dtype=np.float32)

    return np.maximum(field, field.max() / max_gain, dtype=np.float32)


def upsample_field(field: FloatImage, width: int, height: int) -> FloatImage:
    """Resize a paper field to image size in memory (for proxies and tests).

    Args:
        field: Field from :func:`estimate_paper_field`.
        width: Target width.
        height: Target height.

    Returns:
        Field of shape ``(height, width, 3)``.
    """
    return np.asarray(
        cv2.resize(field, (width, height), interpolation=cv2.INTER_LINEAR), dtype=np.float32
    )


def estimate_black_point(image: FloatImage, field: FloatImage, percentile: float) -> float:
    """Find the darkest ink level after flat-fielding.

    Args:
        image: RGB proxy, float 0-1.
        field: Paper field for the same image.
        percentile: Luminance percentile treated as black.

    Returns:
        Black point in flat-fielded luminance units (paper is 1.0).
    """
    height, width, _ = image.shape
    flat = image / np.maximum(upsample_field(field, width, height), _EPSILON)

    return float(np.clip(np.percentile(flat @ _LUMA, percentile), 0.0, 0.9))


def apply_tone_numpy(image: FloatImage, correction: ToneCorrection) -> FloatImage:
    """Apply a tone correction to an in-memory image.

    Mirrors :func:`apply_tone_vips` exactly; used for proxies and tests.

    Args:
        image: RGB float image, 0-1.
        correction: Estimated correction.

    Returns:
        Corrected RGB float image, 0-1.
    """
    height, width, _ = image.shape
    field = np.maximum(upsample_field(correction.paper_field, width, height), _EPSILON)
    gain, offset = _linear_terms(correction)
    corrected = (image / field) * gain + offset

    return np.clip(corrected, 0.0, 1.0).astype(np.float32)


def apply_tone_vips(image: pyvips.Image, correction: ToneCorrection) -> pyvips.Image:
    """Apply a tone correction to a full-resolution image lazily.

    Args:
        image: Lazy 3-band float RGB image, 0-1.
        correction: Estimated correction.

    Returns:
        Lazy 8-bit sRGB image.
    """
    field = _upsample_field_vips(correction.paper_field, image.width, image.height)
    gain, offset = _linear_terms(correction)
    scaled_gain = [g * 255.0 for g in gain]
    scaled_offset = [o * 255.0 + 0.5 for o in offset]
    corrected = (image / field).linear(scaled_gain, scaled_offset)

    return corrected.cast("uchar").copy(interpretation="srgb")


def _linear_terms(correction: ToneCorrection) -> tuple[list[float], list[float]]:
    """Per-channel ``gain, offset`` that stretch black point..paper to 0..paper_tone."""
    black = correction.black_point
    tone = [channel / 255.0 for channel in correction.paper_tone]
    gain = [t / (1.0 - black) for t in tone]
    offset = [-black * g for g in gain]

    return gain, offset


def _upsample_field_vips(field: FloatImage, width: int, height: int) -> pyvips.Image:
    """Bilinearly stretch the small field to ``width x height`` (pixel-center aligned)."""
    rows, cols, _ = field.shape
    clamped = np.maximum(field, _EPSILON).astype(np.float32)
    scale_x, scale_y = width / cols, height / rows

    return numpy_to_vips(clamped).affine(
        [scale_x, 0.0, 0.0, scale_y],
        oarea=[0, 0, width, height],
        odx=0.5 * scale_x - 0.5,
        ody=0.5 * scale_y - 0.5,
        interpolate=pyvips.Interpolate.new("bilinear"),
        extend="copy",
    )
