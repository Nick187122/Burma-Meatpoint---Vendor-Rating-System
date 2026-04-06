"""
Export Burma Meat Point data into collection-oriented JSON files suitable for
Mongo-style NoSQL imports.

Usage:
  python database/export_to_nosql_json.py

The script boots Django using the active backend settings, reads the current
database configured in `backend/config/settings.py`, and writes one JSON file
per collection into `database/nosql_export/`.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
EXPORT_DIR = ROOT / "database" / "nosql_export"

sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from core.models import (  # noqa: E402
    AdminAuditLog,
    Favorite,
    FlaggedReview,
    Rating,
    RatingAlgorithmConfig,
    ShopNameChangeRequest,
    User,
    VendorDetails,
    VendorReply,
    VendorRequest,
)


def write_collection(name: str, rows: list[dict]) -> None:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    target = EXPORT_DIR / f"{name}.json"
    target.write_text(json.dumps(rows, indent=2, default=str), encoding="utf-8")


def export() -> None:
    write_collection("users", list(User.objects.values()))
    write_collection("vendor_details", list(VendorDetails.objects.values()))
    write_collection("vendor_requests", list(VendorRequest.objects.values()))
    write_collection("ratings", list(Rating.objects.values()))
    write_collection("vendor_replies", list(VendorReply.objects.values()))
    write_collection("flagged_reviews", list(FlaggedReview.objects.values()))
    write_collection("rating_algorithm_config", list(RatingAlgorithmConfig.objects.values()))
    write_collection("shop_name_change_requests", list(ShopNameChangeRequest.objects.values()))
    write_collection("favorites", list(Favorite.objects.values()))
    write_collection("admin_audit_logs", list(AdminAuditLog.objects.values()))
    print(f"NoSQL export written to {EXPORT_DIR}")


if __name__ == "__main__":
    export()
