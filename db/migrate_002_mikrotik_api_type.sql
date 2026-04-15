-- Migration 002: tambah kolom mikrotik_api_type untuk support RouterOS v6 (binary API)
-- Jalankan sekali di server yang sudah ada DB-nya:
--   docker exec -i nms-pbg-db-1 psql -U nms -d nms < db/migrate_002_mikrotik_api_type.sql

ALTER TABLE servers
    ADD COLUMN IF NOT EXISTS mikrotik_api_type VARCHAR(10) DEFAULT 'rest';

-- Server mikrotik yang sudah ada diasumsikan pakai REST (v7), bisa diubah manual
UPDATE servers SET mikrotik_api_type = 'rest' WHERE type = 'mikrotik' AND mikrotik_api_type IS NULL;
