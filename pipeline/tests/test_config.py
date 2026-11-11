from pathlib import Path

import pytest

from spomenica_pipeline.cli import build_config
from spomenica_pipeline.config import REPO_ROOT, PipelineConfig


def test_defaults_point_into_repo() -> None:
    config = PipelineConfig()

    assert config.source_image == REPO_ROOT / "source" / "better-scanned-version.jpeg"
    assert config.master_path.parent == config.output_dir


@pytest.mark.parametrize("degrees", [45, -90, 360])
def test_rejects_invalid_rotation(degrees: int) -> None:
    with pytest.raises(ValueError, match="rotate_degrees"):
        PipelineConfig(rotate_degrees=degrees)


def test_rejects_invalid_quality() -> None:
    with pytest.raises(ValueError, match="tile_quality"):
        PipelineConfig(tile_quality=0)


def test_cli_overrides(tmp_path: Path) -> None:
    scan = tmp_path / "scan.tif"
    config = build_config(["--source", str(scan), "--rotate", "0"])

    assert config.source_image == scan
    assert config.rotate_degrees == 0


def test_rejects_unknown_tile_format() -> None:
    with pytest.raises(ValueError, match="tile_format"):
        PipelineConfig(tile_format="png")
