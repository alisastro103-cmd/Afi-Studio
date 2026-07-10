-- db/migration-002-add-app-target.sql
--
-- PENTING: Beda dengan schema.sql (yang isinya CREATE TABLE IF NOT EXISTS),
-- file ini KHUSUS buat nambah kolom baru ke tabel `models` yang SUDAH ada
-- isi datanya di production. Jalankan SEKALI SAJA lewat Turso Web Dashboard
-- (menu SQL/Shell di database afi-studio-db) atau lewat HTTP REST API
-- (endpoint /v2/pipeline) kalau CLI masih bermasalah di Termux.
--
-- Aman dijalankan: data 15 model yang sudah ada TIDAK hilang, cuma nambah
-- kolom baru yang awalnya kosong (NULL) untuk semua baris lama.

ALTER TABLE models ADD COLUMN app_target TEXT;
