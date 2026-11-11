import cv2
import numpy as np
import pytest

from spomenica_pipeline.images import FloatImage

PAPER = np.array([0.80, 0.72, 0.85], dtype=np.float32)  # purple-cast paper
INK = np.array([0.15, 0.12, 0.25], dtype=np.float32)


def synthetic_document(width: int = 240, height: int = 320) -> FloatImage:
    """Paper with a few ink strokes, uniform lighting."""
    image = np.empty((height, width, 3), dtype=np.float32)
    image[:] = PAPER

    for y in range(30, height - 30, 24):
        cv2.line(image, (30, y), (width - 30, y), INK.tolist(), 2)

    return image


@pytest.fixture
def document() -> FloatImage:
    return synthetic_document()


@pytest.fixture
def vignetted(document: FloatImage) -> FloatImage:
    """The synthetic document darkened towards the corners."""
    height, width, _ = document.shape
    ys, xs = np.mgrid[0:height, 0:width].astype(np.float32)
    radius = np.hypot((xs - width / 2) / width, (ys - height / 2) / height)
    falloff = 1.0 - 0.9 * radius**2

    return np.asarray(document * falloff[..., None], dtype=np.float32)
