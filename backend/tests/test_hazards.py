from hazards import haversine, validate, ValidationError
import pytest

GOOD = {"lat": 16.3067, "lng": 80.4365, "severity": "medium", "source": "photo", "confidence": 0.81, "note": "near the bus stand"}


def test_validate_cleans_input():
    v = validate({**GOOD, "note": "<b>deep</b> one\n", "source": "drone"})
    assert v["note"] == "bdeep/b one"
    assert v["source"] == "manual"  # unknown source falls back
    assert v["confidence"] == 0.81


@pytest.mark.parametrize(
    "patch",
    [{"lat": 91}, {"lng": "abc"}, {"severity": "huge"}, {"confidence": 2}, {"lat": True}],
)
def test_validate_rejects_bad_values(patch):
    with pytest.raises(ValidationError):
        validate({**GOOD, **patch})


def test_haversine_known_distance():
    # Guntur to Vijayawada centre is roughly 29 km in a straight line
    d = haversine(16.3067, 80.4365, 16.5062, 80.6480)
    assert 30_000 < d < 32_000


def test_post_and_list(client):
    r = client.post("/api/hazards", json=GOOD)
    assert r.status_code == 201
    h = r.get_json()["hazard"]
    assert h["confirmations"] == 1 and h["severity"] == "medium"
    listed = client.get("/api/hazards").get_json()
    assert listed["count"] == 1 and listed["hazards"][0]["id"] == h["id"]


def test_nearby_report_is_merged(client):
    client.post("/api/hazards", json=GOOD)
    # about 5 m away and worse: same pothole, severity goes up
    r = client.post("/api/hazards", json={**GOOD, "lat": GOOD["lat"] + 0.00004, "severity": "high"})
    assert r.status_code == 200
    body = r.get_json()
    assert body["merged"] is True
    assert body["hazard"]["confirmations"] == 2 and body["hazard"]["severity"] == "high"
    # 100 m away is a new one
    r = client.post("/api/hazards", json={**GOOD, "lat": GOOD["lat"] + 0.0009})
    assert r.status_code == 201
    assert client.get("/api/hazards").get_json()["count"] == 2


def test_rejects_bad_json_and_big_bodies(client):
    assert client.post("/api/hazards", data="nope", content_type="application/json").status_code == 400
    assert client.post("/api/hazards", json={**GOOD, "severity": "x"}).status_code == 400
    big = {**GOOD, "note": "a" * 3000}
    assert client.post("/api/hazards", json=big).status_code == 413


def test_rate_limit(client):
    codes = [client.post("/api/hazards", json={**GOOD, "lat": GOOD["lat"] + i * 0.001}).status_code for i in range(13)]
    assert codes[:12] == [201] * 12
    assert codes[12] == 429
