#!/usr/bin/env python3
"""
validate_data.py — Cek videos.json & Models/models.json sebelum push.

Jalanin dari root folder proyek:
    python3 validate_data.py

Script ini TIDAK mengubah file apapun, cuma baca dan validasi. Kalau ada
masalah, dicetak semua sekaligus (bukan berhenti di error pertama) biar bisa
langsung dibenerin semua dalam satu kali baca. Exit code 0 = aman untuk push,
exit code 1 = ada yang perlu dibenerin dulu.

Aturan validasi lengkap ada di data.schema.md.
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VIDEOS_PATH = ROOT / "videos.json"
MODELS_PATH = ROOT / "Models" / "models.json"

YOUTUBE_URL_RE = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([A-Za-z0-9_-]{11})"
)
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
VALID_APP_TARGETS = {"Prisma3D", "Blender", "Mine-Imator", "Viontri", "C4D", "Lainnya"}


class Reporter:
    """Ngumpulin semua error/warning biar dicetak sekaligus di akhir."""

    def __init__(self, file_label):
        self.file_label = file_label
        self.errors = []
        self.warnings = []

    def error(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)

    def has_errors(self):
        return len(self.errors) > 0

    def print_report(self):
        print(f"\n=== {self.file_label} ===")
        if not self.errors and not self.warnings:
            print("  ✅ Semua aman.")
            return
        for e in self.errors:
            print(f"  ❌ {e}")
        for w in self.warnings:
            print(f"  ⚠️  {w}")


def load_json(path, reporter):
    if not path.exists():
        reporter.error(f"File tidak ditemukan: {path}")
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        reporter.error(f"JSON tidak valid: {e}")
        return None


def validate_videos(data, reporter):
    if not isinstance(data, list):
        reporter.error("videos.json harus berupa array (list), bukan object/tipe lain.")
        return

    seen_ids = {}
    for i, entry in enumerate(data):
        label = f"Entri #{i + 1}"

        if not isinstance(entry, dict):
            reporter.error(f"{label}: harus berupa object, ditemukan {type(entry).__name__}.")
            continue

        # Field wajib
        for field in ("id", "title", "url", "added"):
            if field not in entry or entry.get(field) in (None, ""):
                reporter.error(f"{label} ({entry.get('title', '?')!r}): field '{field}' wajib diisi.")

        # id unik
        vid = entry.get("id")
        if vid:
            if vid in seen_ids:
                reporter.error(
                    f"{label}: id '{vid}' duplikat (sudah dipakai di entri #{seen_ids[vid] + 1})."
                )
            else:
                seen_ids[vid] = i

        # url valid YouTube
        url = entry.get("url")
        if url:
            if not YOUTUBE_URL_RE.search(url):
                reporter.error(
                    f"{label} ({entry.get('title', '?')!r}): url '{url}' tidak mengandung ID video YouTube yang valid."
                )

        # added valid tanggal
        added = entry.get("added")
        if added:
            if not DATE_RE.match(added):
                reporter.error(
                    f"{label} ({entry.get('title', '?')!r}): 'added' harus format YYYY-MM-DD, ditemukan '{added}'."
                )
            else:
                try:
                    parsed = datetime.strptime(added, "%Y-%m-%d")
                    if parsed > datetime.now():
                        reporter.warn(
                            f"{label} ({entry.get('title', '?')!r}): tanggal 'added' ({added}) ada di masa depan."
                        )
                except ValueError:
                    reporter.error(
                        f"{label} ({entry.get('title', '?')!r}): 'added' ({added}) bukan tanggal yang valid."
                    )


def validate_models(data, reporter):
    if not isinstance(data, list):
        reporter.error("models.json harus berupa array (list), bukan object/tipe lain.")
        return

    for i, entry in enumerate(data):
        label = f"Entri #{i + 1}"

        if not isinstance(entry, dict):
            reporter.error(f"{label}: harus berupa object, ditemukan {type(entry).__name__}.")
            continue

        name = entry.get("name", "?")

        # Field wajib
        for field in ("name", "caption", "category", "thumb", "link"):
            if field not in entry or entry.get(field) in (None, ""):
                reporter.error(f"{label} ({name!r}): field '{field}' wajib diisi.")

        # category harus array non-kosong
        category = entry.get("category")
        if category is not None:
            if not isinstance(category, list):
                reporter.error(f"{label} ({name!r}): 'category' harus array, ditemukan {type(category).__name__}.")
            elif len(category) == 0:
                reporter.error(f"{label} ({name!r}): 'category' tidak boleh array kosong.")
            elif not all(isinstance(c, str) and c.strip() for c in category):
                reporter.error(f"{label} ({name!r}): semua isi 'category' harus string non-kosong.")

        # thumb & link harus URL http(s)
        for field in ("thumb", "link"):
            val = entry.get(field)
            if val and not (val.startswith("http://") or val.startswith("https://")):
                reporter.error(f"{label} ({name!r}): '{field}' harus diawali http:// atau https://, ditemukan '{val}'.")

        # app_target harus dari daftar valid kalau diisi
        app_target = entry.get("app_target")
        if app_target and app_target not in VALID_APP_TARGETS:
            reporter.error(
                f"{label} ({name!r}): 'app_target' ({app_target!r}) tidak dikenal. "
                f"Harus salah satu dari: {', '.join(sorted(VALID_APP_TARGETS))}."
            )


def main():
    overall_ok = True

    videos_reporter = Reporter("videos.json")
    videos_data = load_json(VIDEOS_PATH, videos_reporter)
    if videos_data is not None:
        validate_videos(videos_data, videos_reporter)
    videos_reporter.print_report()
    if videos_reporter.has_errors():
        overall_ok = False

    models_reporter = Reporter("Models/models.json")
    models_data = load_json(MODELS_PATH, models_reporter)
    if models_data is not None:
        validate_models(models_data, models_reporter)
    models_reporter.print_report()
    if models_reporter.has_errors():
        overall_ok = False

    print()
    if overall_ok:
        print("✅ Semua data valid — aman buat push.")
        sys.exit(0)
    else:
        print("❌ Ada masalah di atas — perbaiki dulu sebelum push.")
        sys.exit(1)


if __name__ == "__main__":
    main()
