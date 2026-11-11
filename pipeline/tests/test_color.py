import numpy as np

from spomenica_pipeline import color
from spomenica_pipeline.config import PipelineConfig
from spomenica_pipeline.images import FloatImage, numpy_to_vips, vips_to_numpy

from .conftest import PAPER

DEFAULTS = PipelineConfig()
TONE = DEFAULTS.paper_tone


def _correction(image: FloatImage, max_gain: float = 10.0) -> color.ToneCorrection:
    field = color.estimate_paper_field(
        image, DEFAULTS.illumination_grid, DEFAULTS.paper_percentile, max_gain
    )

    return color.ToneCorrection(
        paper_field=field,
        black_point=color.estimate_black_point(image, field, DEFAULTS.black_point_percentile),
        paper_tone=TONE,
    )


def test_paper_field_finds_paper_color(document: FloatImage) -> None:
    field = color.estimate_paper_field(document, grid=8, percentile=90, max_gain=10)

    np.testing.assert_allclose(field.reshape(-1, 3).mean(axis=0), PAPER, atol=0.01)


def test_max_gain_limits_field(vignetted: FloatImage) -> None:
    field = color.estimate_paper_field(vignetted, grid=8, percentile=90, max_gain=1.5)

    assert field.min() >= field.max() / 1.5 - 1e-6


def test_flat_field_removes_vignette_and_cast(document: FloatImage, vignetted: FloatImage) -> None:
    corrected = color.apply_tone_numpy(vignetted, _correction(vignetted))
    paper_pixels = corrected[np.all(document == PAPER, axis=-1)]

    # Paper is uniform everywhere and has the target tone, not the purple cast.
    assert paper_pixels.std(axis=0).max() < 0.03
    np.testing.assert_allclose(np.median(paper_pixels, axis=0), np.array(TONE) / 255, atol=0.03)


def test_ink_stays_dark(vignetted: FloatImage) -> None:
    corrected = color.apply_tone_numpy(vignetted, _correction(vignetted))

    assert corrected.min() < 0.05


def test_vips_and_numpy_corrections_agree(vignetted: FloatImage) -> None:
    correction = _correction(vignetted)

    expected = color.apply_tone_numpy(vignetted, correction)
    actual = vips_to_numpy(color.apply_tone_vips(numpy_to_vips(vignetted), correction))

    assert np.abs(actual - expected).max() < 3 / 255
