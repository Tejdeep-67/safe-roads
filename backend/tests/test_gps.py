import io

from PIL import Image

from gps import gps_from_image


def _jpeg_with_gps(lat, lat_ref, lng, lng_ref):
    img = Image.new("RGB", (32, 32))
    exif = Image.Exif()
    gps = exif.get_ifd(0x8825)
    gps[1], gps[2] = lat_ref, lat
    gps[3], gps[4] = lng_ref, lng
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif)
    buf.seek(0)
    return Image.open(buf)


def test_reads_gps():
    # 16 deg 18' 24" N, 80 deg 26' 11.4" E  (Guntur)
    im = _jpeg_with_gps((16.0, 18.0, 24.0), "N", (80.0, 26.0, 11.4), "E")
    lat, lng = gps_from_image(im)
    assert abs(lat - 16.306667) < 1e-5 and abs(lng - 80.436500) < 1e-5


def test_southern_western_signs():
    lat, lng = gps_from_image(_jpeg_with_gps((33.0, 52.0, 0.0), "S", (151.0, 12.0, 0.0), "W"))
    assert lat < 0 and lng < 0


def test_no_gps():
    assert gps_from_image(Image.new("RGB", (8, 8))) is None
