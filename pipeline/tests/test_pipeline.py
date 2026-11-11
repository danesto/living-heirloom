from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np
import pyvips

from spomenica_pipeline.config import PipelineConfig
from spomenica_pipeline.pipeline import run

from .conftest import synthetic_document


def _write_source(path: Path) -> None:
    """Save a sideways synthetic document as an 8-bit JPEG."""
    document = np.rot90(synthetic_document(300, 400), k=1)  # top now points left
    pixels = np.ascontiguousarray((document * 255).astype(np.uint8))
    height, width, _ = pixels.shape
    image = pyvips.Image.new_from_memory(pixels.tobytes(), width, height, 3, "uchar")
    image.jpegsave(str(path))


def test_end_to_end(tmp_path: Path) -> None:
    source = tmp_path / "scan.jpg"
    _write_source(source)
    config = PipelineConfig(
        source_image=source,
        output_dir=tmp_path / "out",
        tiles_dir=tmp_path / "tiles",
        rotate_degrees=90,
        corners=((0.05, 0.05), (0.95, 0.05), (0.95, 0.95), (0.05, 0.95)),
        tile_size=64,
    )

    result = run(config)

    assert result.document_detected
    assert result.size.height > result.size.width  # upright portrait
    assert result.master.is_file()
    assert result.preview.is_file()
    size = ET.parse(result.dzi).getroot()[0].attrib
    assert (int(size["Width"]), int(size["Height"])) == (result.size.width, result.size.height)
    assert ET.parse(result.dzi).getroot().attrib["Format"] == config.tile_format
    assert (tmp_path / "tiles" / "spomenica_files" / "0" / f"0_0.{config.tile_format}").is_file()
    assert not (tmp_path / "tiles" / "spomenica_files" / "vips-properties.xml").exists()
