"""Loading images and converting between libvips and NumPy.

libvips images are lazy: operations build a pipeline that is only evaluated, tile by tile,
when the result is written. NumPy arrays are used only for small analysis proxies.
"""

from pathlib import Path

import numpy as np
import numpy.typing as npt
import pyvips

type FloatImage = npt.NDArray[np.float32]
"""RGB image as ``(height, width, 3)`` float32 in the range 0-1."""

_FORMAT_MAX = {"uchar": 255.0, "ushort": 65535.0, "float": 1.0, "double": 1.0}


def load_source(path: Path) -> pyvips.Image:
    """Open the full-resolution source lazily (pixels are read on demand).

    Args:
        path: Image file readable by libvips (JPEG, TIFF, PNG, ...).

    Returns:
        The image as a lazy libvips image with random access (needed for warping).
    """
    return pyvips.Image.new_from_file(str(path))


def load_proxy(path: Path, max_side: int) -> pyvips.Image:
    """Load a downscaled copy of the source for analysis.

    Uses libvips shrink-on-load, so even multi-gigapixel files are cheap to open.

    Args:
        path: Image file readable by libvips.
        max_side: Longest side of the result, in pixels.

    Returns:
        The downscaled image, not auto-rotated by EXIF (rotation is explicit in config).
    """
    thumbnail = pyvips.Image.thumbnail(str(path), max_side, height=max_side, no_rotate=True)

    # Thumbnails stream sequentially; materialize so later steps can access pixels freely.
    return thumbnail.copy_memory()


def to_rgb_float(image: pyvips.Image) -> pyvips.Image:
    """Normalize any input to 3-band float RGB in the range 0-1.

    Handles alpha (flattened onto white), greyscale, and 8-bit, 16-bit and float inputs
    (float inputs are assumed to already be in the range 0-1).

    Args:
        image: Lazy libvips image in any common format.

    Returns:
        Lazy 3-band float image.
    """
    scale = _FORMAT_MAX.get(image.format, 255.0)

    if image.hasalpha():
        image = image.flatten(background=[scale])

    if image.bands == 1:
        image = image.bandjoin([image, image])
    elif image.bands > 3:
        image = image[0].bandjoin([image[1], image[2]])

    return image.cast("float").linear(1.0 / scale, 0.0)


def vips_to_numpy(image: pyvips.Image) -> FloatImage:
    """Materialize a (small) libvips image as a NumPy RGB float array.

    Args:
        image: Image of any format; converted with :func:`to_rgb_float` first.

    Returns:
        Array of shape ``(height, width, 3)``, float32, range 0-1.
    """
    rgb = to_rgb_float(image)
    buffer = rgb.write_to_memory()

    return np.frombuffer(buffer, dtype=np.float32).reshape(rgb.height, rgb.width, 3).copy()


def numpy_to_vips(array: FloatImage) -> pyvips.Image:
    """Wrap a float32 ``(height, width, bands)`` array as a libvips image.

    Args:
        array: Float32 array with 3 dimensions.

    Returns:
        A libvips float image with the same contents.
    """
    contiguous = np.ascontiguousarray(array, dtype=np.float32)
    height, width, bands = contiguous.shape

    return pyvips.Image.new_from_memory(contiguous.tobytes(), width, height, bands, "float")
