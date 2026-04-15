-- Migration 001: api_key tidak wajib untuk server tipe mikrotik
-- Jalankan sekali di server yang sudah ada DB-nya:
--   docker exec -i nms-pbg-db-1 psql -U nms -d nms < db/migrate_001_mikrotik_apikey.sql

ALTER TABLE servers ALTER COLUMN api_key DROP NOT NULL;

-- Set api_key = NULL untuk server mikrotik yang sudah ada
UPDATE servers SET api_key = NULL WHERE type = 'mikrotik';
