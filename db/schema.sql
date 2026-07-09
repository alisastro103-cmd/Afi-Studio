-- schema.sql
-- Jalankan sekali di awal lewat Turso CLI atau dashboard Turso:
--   turso db shell nama-db < db/schema.sql

CREATE TABLE IF NOT EXISTS models (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  caption    TEXT,
  creator    TEXT,
  converter  TEXT,
  category   TEXT,      -- disimpan sebagai teks dipisah koma, contoh: "Minecraft,Rig,Mob,Free"
  thumb      TEXT,
  link       TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Kolom disesuaikan persis dengan field yang sudah ada di member.json
-- (nama, foto, spesialis, identitas, generasi, socials), supaya migrasi
-- data lama tidak perlu mapping ulang nama field.
CREATE TABLE IF NOT EXISTS members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  gen_id     TEXT NOT NULL,   -- kode grup teknis, harus PERSIS sama dengan id div container di HTML
                              -- (contoh: "gen-1", "gen-2", "gen-3", "orang-random")
  generasi   TEXT,            -- label yang ditampilkan ke user, contoh: "Generasi ke-1" atau teks bebas
  nama       TEXT NOT NULL,
  foto       TEXT,
  spesialis  TEXT,
  identitas  TEXT,            -- emoji penanda
  socials    TEXT,            -- disimpan sebagai JSON string: {"yt":"","ig":"","fb":"","tk":"","wa":"","dc":""}
  created_at TEXT DEFAULT (datetime('now'))
);
