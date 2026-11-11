"""Rotation, document edge detection and perspective correction.

Detection runs on a small NumPy proxy (OpenCV); the resulting transform is applied to the
full-resolution image lazily with libvips, so large scans never sit in RAM all at once.
"""

from dataclasses import dataclass

import cv2
import numpy as np
import numpy.typing as npt
import pyvips

from spomenica_pipeline.config import Corners
from spomenica_pipeline.images import FloatImage

type Quad = npt.NDArray[np.float64]
"""Four corner points, shape ``(4, 2)``, ordered top-left, top-right, bottom-right,
bottom-left, in pixel coordinates (pixel centers at integers)."""

_VIPS_ANGLES = {0: "d0", 90: "d90", 180: "d180", 270: "d270"}
_MAX_DOCUMENT_AREA = 0.98
_POLY_EPSILON = 0.02
_MIN_QUAD_FILL = 0.9


@dataclass(frozen=True, slots=True)
class Size:
    """Image size in pixels."""

    width: int
    height: int


def rotate(image: pyvips.Image, degrees: int) -> pyvips.Image:
    """Rotate clockwise by a multiple of 90 degrees.

    Args:
        image: Lazy libvips image.
        degrees: 0, 90, 180 or 270.

    Returns:
        The rotated image.
    """
    return image.rot(_VIPS_ANGLES[degrees])


def order_corners(points: npt.ArrayLike) -> Quad:
    """Order four arbitrary points as top-left, top-right, bottom-right, bottom-left.

    Args:
        points: Four ``(x, y)`` points in any order.

    Returns:
        The points as a ``(4, 2)`` float array in canonical order.

    Raises:
        ValueError: If there are not exactly four points.
    """
    pts = np.asarray(points, dtype=np.float64).reshape(-1, 2)

    if pts.shape != (4, 2):
        msg = f"expected 4 points, got {pts.shape[0]}"
        raise ValueError(msg)

    sums = pts.sum(axis=1)
    diffs = pts[:, 1] - pts[:, 0]

    return np.array(
        [pts[np.argmin(sums)], pts[np.argmin(diffs)], pts[np.argmax(sums)], pts[np.argmax(diffs)]],
    )


def corners_to_quad(corners: Corners, size: Size) -> Quad:
    """Convert normalized (0-1) corners to pixel coordinates.

    Args:
        corners: Normalized corners, top-left, top-right, bottom-right, bottom-left.
        size: Size of the image the corners refer to.

    Returns:
        Pixel-coordinate quad.
    """
    scale = np.array([size.width, size.height], dtype=np.float64)

    return order_corners(np.array(corners, dtype=np.float64) * scale - 0.5)


def scale_quad(quad: Quad, source: Size, target: Size) -> Quad:
    """Map a quad from one image resolution to another (pixel-center aware).

    Args:
        quad: Quad in ``source`` pixel coordinates.
        source: Size the quad refers to.
        target: Size to map into.

    Returns:
        The quad in ``target`` pixel coordinates.
    """
    factor = np.array(
        [target.width / source.width, target.height / source.height], dtype=np.float64
    )

    return (quad + 0.5) * factor - 0.5


def detect_document_quad(image: FloatImage, min_area: float) -> Quad | None:
    """Find the four corners of the document in a proxy image.

    Thresholds the image in both polarities (paper brighter or darker than its
    background) and keeps the largest contour that simplifies to a convex quadrilateral.

    Args:
        image: RGB proxy, float 0-1.
        min_area: Minimum document area as a fraction of the image area.

    Returns:
        The document quad, or ``None`` if no convincing document edge was found
        (e.g. the paper fills the whole photo).
    """
    gray = cv2.cvtColor((image * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (0, 0), max(gray.shape) / 400)
    _, mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    image_area = float(gray.shape[0] * gray.shape[1])
    best: Quad | None = None
    best_area = 0.0

    for candidate in (mask, cv2.bitwise_not(mask)):
        closed = cv2.morphologyEx(candidate, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for contour in contours:
            contour_area = cv2.contourArea(contour)
            fraction = contour_area / image_area

            if not min_area <= fraction <= _MAX_DOCUMENT_AREA or contour_area <= best_area:
                continue

            approx = cv2.approxPolyDP(contour, _POLY_EPSILON * cv2.arcLength(contour, True), True)

            if len(approx) != 4 or not cv2.isContourConvex(approx):
                continue

            if contour_area / cv2.contourArea(approx) < _MIN_QUAD_FILL:
                continue

            best = order_corners(approx)
            best_area = contour_area

    return best


def output_size(quad: Quad) -> Size:
    """Size of the rectified document: the longer of each pair of opposite edges.

    Args:
        quad: Ordered document quad.

    Returns:
        Output width and height in pixels.
    """
    tl, tr, br, bl = quad
    width = max(np.linalg.norm(tr - tl), np.linalg.norm(br - bl))
    height = max(np.linalg.norm(bl - tl), np.linalg.norm(br - tr))

    return Size(round(float(width)), round(float(height)))


def perspective_matrix(quad: Quad, size: Size) -> npt.NDArray[np.float64]:
    """Homography mapping the document quad onto an upright ``size`` rectangle.

    Args:
        quad: Ordered document quad in source pixel coordinates.
        size: Output size.

    Returns:
        3x3 matrix mapping source to output coordinates.
    """
    target = np.array(
        [[0, 0], [size.width - 1, 0], [size.width - 1, size.height - 1], [0, size.height - 1]],
        dtype=np.float32,
    )
    matrix = cv2.getPerspectiveTransform(quad.astype(np.float32), target)

    return np.asarray(matrix, dtype=np.float64)


def warp_numpy(image: FloatImage, quad: Quad, size: Size) -> FloatImage:
    """Rectify a small in-memory image (used for the analysis proxy).

    Args:
        image: RGB float image.
        quad: Ordered document quad in ``image`` coordinates.
        size: Output size.

    Returns:
        The rectified image.
    """
    matrix = perspective_matrix(quad, size)
    warped = cv2.warpPerspective(
        image,
        matrix,
        (size.width, size.height),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )

    return np.asarray(warped, dtype=np.float32)


def warp_vips(image: pyvips.Image, quad: Quad, size: Size) -> pyvips.Image:
    """Rectify a full-resolution image lazily with libvips ``mapim``.

    For every output pixel the inverse homography gives the source position, computed
    on the fly per tile, so memory use stays small regardless of image size.

    Args:
        image: Lazy libvips image.
        quad: Ordered document quad in ``image`` coordinates.
        size: Output size.

    Returns:
        Lazy rectified image.
    """
    inverse = np.linalg.inv(perspective_matrix(quad, size))
    coords = pyvips.Image.xyz(size.width, size.height).cast("float")
    x, y = coords[0], coords[1]

    def project(row: int) -> pyvips.Image:
        return x * float(inverse[row, 0]) + y * float(inverse[row, 1]) + float(inverse[row, 2])

    w = project(2)
    index = (project(0) / w).bandjoin(project(1) / w)

    return image.mapim(index, interpolate=pyvips.Interpolate.new("bicubic"), extend="copy")
