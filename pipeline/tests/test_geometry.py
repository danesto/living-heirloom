import cv2
import numpy as np
import pytest

from spomenica_pipeline import geometry
from spomenica_pipeline.geometry import Size
from spomenica_pipeline.images import numpy_to_vips, vips_to_numpy

from .conftest import synthetic_document


def test_order_corners_any_input_order() -> None:
    shuffled = [(90, 10), (5, 95), (10, 5), (100, 100)]

    ordered = geometry.order_corners(shuffled)

    assert ordered.tolist() == [[10, 5], [90, 10], [100, 100], [5, 95]]


def test_order_corners_rejects_wrong_count() -> None:
    with pytest.raises(ValueError, match="4 points"):
        geometry.order_corners([(0, 0), (1, 1), (2, 2)])


def test_corners_to_quad_uses_pixel_centers() -> None:
    corners = ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))

    quad = geometry.corners_to_quad(corners, Size(100, 50))

    assert quad.tolist() == [[-0.5, -0.5], [99.5, -0.5], [99.5, 49.5], [-0.5, 49.5]]


def test_scale_quad_round_trip() -> None:
    quad = geometry.order_corners([(10, 20), (300, 25), (310, 400), (5, 390)])
    small, large = Size(320, 420), Size(3200, 4200)

    restored = geometry.scale_quad(geometry.scale_quad(quad, small, large), large, small)

    np.testing.assert_allclose(restored, quad)


def test_output_size_takes_longest_edges() -> None:
    quad = geometry.order_corners([(0, 0), (100, 0), (110, 200), (0, 190)])

    size = geometry.output_size(quad)

    assert size.width == 110
    assert size.height == 200


def _photo_of_document() -> tuple[np.ndarray, np.ndarray]:
    """A document pasted in perspective onto a dark background."""
    document = synthetic_document(200, 280)
    corners = np.array([[60, 40], [330, 70], [310, 440], [40, 420]], dtype=np.float32)
    source = np.array([[0, 0], [199, 0], [199, 279], [0, 279]], dtype=np.float32)
    matrix = cv2.getPerspectiveTransform(source, corners)
    background = np.full((500, 400, 3), 0.1, dtype=np.float32)
    photo = cv2.warpPerspective(
        document, matrix, (400, 500), dst=background, borderMode=cv2.BORDER_TRANSPARENT
    )

    return np.asarray(photo, dtype=np.float32), corners


def test_detects_document_in_perspective() -> None:
    photo, corners = _photo_of_document()

    quad = geometry.detect_document_quad(photo, min_area=0.2)

    assert quad is not None
    np.testing.assert_allclose(quad, corners, atol=4)


def test_detects_dark_paper_on_bright_background() -> None:
    photo, corners = _photo_of_document()
    inverted = (1.0 - photo).astype(np.float32)

    quad = geometry.detect_document_quad(inverted, min_area=0.2)

    assert quad is not None
    np.testing.assert_allclose(quad, corners, atol=4)


def test_no_detection_when_paper_fills_frame(document: np.ndarray) -> None:
    assert geometry.detect_document_quad(document, min_area=0.2) is None


def test_vips_warp_matches_numpy_warp() -> None:
    photo, corners = _photo_of_document()
    quad = geometry.order_corners(corners)
    size = geometry.output_size(quad)

    expected = geometry.warp_numpy(photo, quad, size)
    actual = vips_to_numpy(geometry.warp_vips(numpy_to_vips(photo), quad, size))

    assert actual.shape == expected.shape
    # Different interpolators (bicubic vs bilinear): compare away from sharp ink edges.
    assert np.median(np.abs(actual - expected)) < 0.01


def test_rectified_document_has_no_background() -> None:
    photo, corners = _photo_of_document()
    quad = geometry.order_corners(corners)

    rectified = geometry.warp_numpy(photo, quad, geometry.output_size(quad))

    # The dark background (0.1) must not appear along the borders.
    borders = np.concatenate([rectified[2, :], rectified[-3, :], rectified[:, 2], rectified[:, -3]])
    assert borders.mean() > 0.6


def test_rotate_clockwise() -> None:
    image = np.zeros((2, 3, 3), dtype=np.float32)
    image[0, 0] = 1.0  # top-left marker

    rotated = vips_to_numpy(geometry.rotate(numpy_to_vips(image), 90))

    assert rotated.shape == (3, 2, 3)
    assert rotated[0, 1, 0] == 1.0  # now top-right
