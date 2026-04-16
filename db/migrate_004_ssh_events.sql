-- Migration 004: SSH events tracking

ALTER TABLE metrics ADD COLUMN IF NOT EXISTS ssh_sessions JSONB;

CREATE TABLE IF NOT EXISTS ssh_events (
    id          BIGSERIAL PRIMARY KEY,
    server_id   INT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    event_type  VARCHAR(10) NOT NULL,
    username    VARCHAR(100),
    ip_address  VARCHAR(100),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ssh_events_server ON ssh_events(server_id, created_at DESC);
