"""Hazard reports stored in SQLite.

Same rules as the Netlify function (netlify/functions/lib/hazards-core.mjs) so the
web app can talk to either one: validation, merging reports within 15 m, and a
simple per-IP rate limit.
"""
from __future__ import annotations

import hashlib
import math
import re
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone

SEVERITIES = ["low", "medium", "high"]
SOURCES = ["camera", "video", "photo", "manual"]
MERGE_RADIUS_M = 15
MAX_REPORTS = 1500
RATE_LIMIT_MAX = 12
RATE_LIMIT_WINDOW_S = 10 * 60

SCHEMA = """
CREATE TABLE IF NOT EXISTS hazards (
    id TEXT PRIMARY KEY,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    severity TEXT NOT NULL,
    confidence REAL,
    source TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT,
    confirmations INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS hazards_created ON hazards(created_at);
"""


class ValidationError(ValueError):
    pass


def haversine(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    r = math.radians
    h = math.sin(r(b_lat - a_lat) / 2) ** 2 + math.cos(r(a_lat)) * math.cos(r(b_lat)) * math.sin(r(b_lng - a_lng) / 2) ** 2
    return 2 * 6371000 * math.asin(min(1.0, math.sqrt(h)))


def _num(v):
    if isinstance(v, bool):
        raise ValueError
    return float(v)


def validate(body) -> dict:
    if not isinstance(body, dict):
        raise ValidationError("body must be a JSON object")
    try:
        lat = _num(body.get("lat"))
        lng = _num(body.get("lng"))
    except (TypeError, ValueError):
        raise ValidationError("lat and lng must be numbers")
    if not math.isfinite(lat) or not -90 <= lat <= 90:
        raise ValidationError("lat out of range")
    if not math.isfinite(lng) or not -180 <= lng <= 180:
        raise ValidationError("lng out of range")
    severity = body.get("severity")
    if severity not in SEVERITIES:
        raise ValidationError("severity must be low, medium or high")
    source = body.get("source") if body.get("source") in SOURCES else "manual"
    confidence = body.get("confidence")
    if confidence is not None:
        try:
            confidence = _num(confidence)
        except (TypeError, ValueError):
            raise ValidationError("confidence must be 0..1")
        if not 0 <= confidence <= 1:
            raise ValidationError("confidence must be 0..1")
        confidence = round(confidence, 2)
    note = body.get("note") if isinstance(body.get("note"), str) else ""
    note = re.sub(r"[\x00-\x1f\x7f<>]", "", note).strip()[:140]
    return {
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "severity": severity,
        "confidence": confidence,
        "source": source,
        "note": note,
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class HazardStore:
    def __init__(self, path: str):
        self.path = path
        self._lock = threading.Lock()
        self._hits: dict[str, list[float]] = {}
        with self._connect() as db:
            db.executescript(SCHEMA)

    def _connect(self):
        db = sqlite3.connect(self.path)
        db.row_factory = sqlite3.Row
        return db

    @staticmethod
    def _row(r: sqlite3.Row) -> dict:
        d = {
            "id": r["id"], "lat": r["lat"], "lng": r["lng"], "severity": r["severity"],
            "confidence": r["confidence"], "source": r["source"], "note": r["note"],
            "createdAt": r["created_at"], "confirmations": r["confirmations"],
        }
        if r["updated_at"]:
            d["updatedAt"] = r["updated_at"]
        return d

    def list(self) -> list[dict]:
        with self._connect() as db:
            rows = db.execute("SELECT * FROM hazards ORDER BY created_at").fetchall()
        return [self._row(r) for r in rows]

    def allow(self, ip: str, now: float | None = None) -> tuple[bool, int]:
        """Sliding window rate limit, kept in memory (fine for a local API)."""
        now = time.time() if now is None else now
        key = hashlib.sha256(f"saferoads:{ip}".encode()).hexdigest()[:24]
        hits = [t for t in self._hits.get(key, []) if now - t < RATE_LIMIT_WINDOW_S]
        if len(hits) >= RATE_LIMIT_MAX:
            self._hits[key] = hits
            return False, int(RATE_LIMIT_WINDOW_S - (now - hits[0])) + 1
        hits.append(now)
        self._hits[key] = hits
        return True, 0

    def add(self, value: dict) -> tuple[dict, bool]:
        """Insert a report, or count it as a confirmation of one within 15 m."""
        with self._lock, self._connect() as db:
            # rough bounding box first, then the exact distance
            d = MERGE_RADIUS_M / 111_000
            cands = db.execute(
                "SELECT * FROM hazards WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?",
                (value["lat"] - d, value["lat"] + d, value["lng"] - d * 2, value["lng"] + d * 2),
            ).fetchall()
            near = next((r for r in cands if haversine(r["lat"], r["lng"], value["lat"], value["lng"]) <= MERGE_RADIUS_M), None)
            now = _now_iso()
            if near:
                sev = value["severity"] if SEVERITIES.index(value["severity"]) > SEVERITIES.index(near["severity"]) else near["severity"]
                db.execute(
                    "UPDATE hazards SET confirmations = confirmations + 1, severity = ?, updated_at = ? WHERE id = ?",
                    (sev, now, near["id"]),
                )
                row = db.execute("SELECT * FROM hazards WHERE id = ?", (near["id"],)).fetchone()
                return self._row(row), True
            hid = str(uuid.uuid4())
            db.execute(
                "INSERT INTO hazards (id, lat, lng, severity, confidence, source, note, created_at) VALUES (?,?,?,?,?,?,?,?)",
                (hid, value["lat"], value["lng"], value["severity"], value["confidence"], value["source"], value["note"], now),
            )
            # keep the table bounded like the online store
            db.execute(
                "DELETE FROM hazards WHERE id IN (SELECT id FROM hazards ORDER BY created_at DESC LIMIT -1 OFFSET ?)",
                (MAX_REPORTS,),
            )
            row = db.execute("SELECT * FROM hazards WHERE id = ?", (hid,)).fetchone()
            return self._row(row), False
