"""Read GPS coordinates from a photo's EXIF data (if the phone saved them)."""
from __future__ import annotations

from PIL import Image

GPS_IFD = 0x8825


def _to_deg(value) -> float:
    d, m, s = (float(x) for x in value)
    return d + m / 60 + s / 3600


def gps_from_image(image: Image.Image) -> tuple[float, float] | None:
    try:
        gps = image.getexif().get_ifd(GPS_IFD)
    except Exception:
        return None
    if not gps or 2 not in gps or 4 not in gps:
        return None
    try:
        lat = _to_deg(gps[2]) * (-1 if gps.get(1) in ("S", b"S") else 1)
        lng = _to_deg(gps[4]) * (-1 if gps.get(3) in ("W", b"W") else 1)
    except (TypeError, ValueError, ZeroDivisionError):
        return None
    if not (-90 <= lat <= 90 and -180 <= lng <= 180) or (lat == 0 and lng == 0):
        return None
    return round(lat, 6), round(lng, 6)
