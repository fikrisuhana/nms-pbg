-- NMS-PBG Database Schema

CREATE TABLE IF NOT EXISTS servers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    hostname    VARCHAR(255),
    description TEXT,
    type        VARCHAR(20) NOT NULL DEFAULT 'linux',  -- 'linux' | 'mikrotik'
    api_key     VARCHAR(64) UNIQUE,  -- NULL untuk mikrotik, UUID untuk linux
    -- Mikrotik-only fields (encrypted at app level)
    mikrotik_host VARCHAR(255),
    mikrotik_user VARCHAR(100),
    mikrotik_pass TEXT,
    mikrotik_port INT DEFAULT 80,
    -- Status
    last_seen   TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metrics (
    id              BIGSERIAL PRIMARY KEY,
    server_id       INT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    recorded_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    cpu_usage       NUMERIC(5,2),           -- percent
    ram_used        BIGINT,                 -- bytes
    ram_total       BIGINT,                 -- bytes
    disk_used       BIGINT,                 -- bytes
    disk_total      BIGINT,                 -- bytes
    net_rx_bytes    BIGINT,                 -- cumulative bytes received
    net_tx_bytes    BIGINT,                 -- cumulative bytes sent
    load_1          NUMERIC(6,2),
    load_5          NUMERIC(6,2),
    load_15         NUMERIC(6,2),
    uptime_seconds  BIGINT,
    process_count   INT,
    ping_ms         NUMERIC(8,2),
    active_sessions INT
);

CREATE INDEX IF NOT EXISTS idx_metrics_server_time ON metrics(server_id, recorded_at DESC);

-- Keep only last 7 days of raw metrics (older ones are auto-pruned by cron in backend)
-- For longer retention, enable TimescaleDB:
-- SELECT create_hypertable('metrics', 'recorded_at', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS thresholds (
    id                  SERIAL PRIMARY KEY,
    server_id           INT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    metric              VARCHAR(20) NOT NULL,   -- cpu | ram | disk | net_rx | net_tx
    warning_pct         NUMERIC(5,2) NOT NULL DEFAULT 80,
    critical_pct        NUMERIC(5,2) NOT NULL DEFAULT 90,
    cooldown_seconds    INT NOT NULL DEFAULT 300,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(server_id, metric)
);

CREATE TABLE IF NOT EXISTS alerts (
    id              BIGSERIAL PRIMARY KEY,
    server_id       INT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    metric          VARCHAR(20) NOT NULL,
    level           VARCHAR(10) NOT NULL,   -- warning | critical
    value           NUMERIC(10,2),
    threshold_pct   NUMERIC(5,2),
    message         TEXT,
    telegram_sent   BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_server ON alerts(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unacked ON alerts(acknowledged, created_at DESC);

CREATE TABLE IF NOT EXISTS telegram_config (
    id          SERIAL PRIMARY KEY,
    bot_token   TEXT NOT NULL DEFAULT '',
    chat_id     TEXT NOT NULL DEFAULT '',
    enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Single row config
INSERT INTO telegram_config (bot_token, chat_id, enabled) VALUES ('', '', false)
ON CONFLICT DO NOTHING;
