const express   = require('express');
const router    = express.Router();
const pool      = require('../db/pool');
const { agentAuth } = require('../middleware/auth');
const { checkThresholds } = require('../services/threshold');

// POST /api/metrics — agent kirim data ke sini
router.post('/', agentAuth, async (req, res) => {
    const server = req.server;
    const b      = req.body;

    try {
        const sshSessions = Array.isArray(b.ssh_sessions) ? b.ssh_sessions : [];

        // Coba ambil snapshot sesi sebelumnya (kolom mungkin belum ada di DB lama)
        let prevSshSessions = null;
        try {
            const prevResult = await pool.query(
                'SELECT ssh_sessions FROM metrics WHERE server_id = $1 ORDER BY recorded_at DESC LIMIT 1',
                [server.id]
            );
            prevSshSessions = prevResult.rows[0]?.ssh_sessions ?? null;
        } catch (_) {}

        // Insert metric — fallback tanpa ssh_sessions kalau kolom belum ada
        try {
            await pool.query(
                `INSERT INTO metrics
                    (server_id, cpu_usage, ram_used, ram_total, disk_used, disk_total,
                     net_rx_bytes, net_tx_bytes, load_1, load_5, load_15,
                     uptime_seconds, process_count, ping_ms, active_sessions, ssh_sessions)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
                [
                    server.id,
                    parseFloat(b.cpu_usage)      || 0,
                    parseInt(b.ram_used)         || 0,
                    parseInt(b.ram_total)        || 0,
                    parseInt(b.disk_used)        || 0,
                    parseInt(b.disk_total)       || 0,
                    parseInt(b.net_rx_bytes)     || 0,
                    parseInt(b.net_tx_bytes)     || 0,
                    parseFloat(b.load_1)         || 0,
                    parseFloat(b.load_5)         || 0,
                    parseFloat(b.load_15)        || 0,
                    parseInt(b.uptime_seconds)   || 0,
                    parseInt(b.process_count)    || 0,
                    parseFloat(b.ping_ms)        || 0,
                    parseInt(b.active_sessions)  || 0,
                    sshSessions.length > 0 ? JSON.stringify(sshSessions) : null,
                ]
            );
        } catch (insertErr) {
            if (insertErr.message.includes('ssh_sessions')) {
                // Kolom belum ada — insert tanpa ssh_sessions
                await pool.query(
                    `INSERT INTO metrics
                        (server_id, cpu_usage, ram_used, ram_total, disk_used, disk_total,
                         net_rx_bytes, net_tx_bytes, load_1, load_5, load_15,
                         uptime_seconds, process_count, ping_ms, active_sessions)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
                    [
                        server.id,
                        parseFloat(b.cpu_usage)      || 0,
                        parseInt(b.ram_used)         || 0,
                        parseInt(b.ram_total)        || 0,
                        parseInt(b.disk_used)        || 0,
                        parseInt(b.disk_total)       || 0,
                        parseInt(b.net_rx_bytes)     || 0,
                        parseInt(b.net_tx_bytes)     || 0,
                        parseFloat(b.load_1)         || 0,
                        parseFloat(b.load_5)         || 0,
                        parseFloat(b.load_15)        || 0,
                        parseInt(b.uptime_seconds)   || 0,
                        parseInt(b.process_count)    || 0,
                        parseFloat(b.ping_ms)        || 0,
                        parseInt(b.active_sessions)  || 0,
                    ]
                );
            } else {
                throw insertErr;
            }
        }

        await pool.query('UPDATE servers SET last_seen = NOW() WHERE id = $1', [server.id]);

        // Deteksi SSH login/logout (fire-and-forget)
        detectSshEvents(server.id, prevSshSessions, sshSessions)
            .catch(err => console.error('[SSH] Event detect error:', err.message));

        // Fire-and-forget threshold check
        checkThresholds(server, b).catch(err =>
            console.error('[Threshold] Check error:', err.message)
        );

        res.json({ ok: true });
    } catch (err) {
        console.error('[Metrics] Insert error:', err.message);
        res.status(500).json({ error: 'Failed to store metric' });
    }
});

async function detectSshEvents(serverId, prevRaw, newSessions) {
    let oldSessions = [];
    if (prevRaw) {
        try {
            oldSessions = typeof prevRaw === 'string' ? JSON.parse(prevRaw) : prevRaw;
        } catch (_) {}
    }
    if (!Array.isArray(oldSessions)) oldSessions = [];

    const toKey = s => `${s.user}@${s.ip}`;
    const oldKeys = new Set(oldSessions.map(toKey));
    const newKeys = new Set(newSessions.map(toKey));

    const events = [];

    // Login: ada di new tapi tidak di old
    for (const s of newSessions) {
        if (!oldKeys.has(toKey(s))) {
            events.push({ type: 'login', user: s.user, ip: s.ip });
        }
    }
    // Logout: ada di old tapi tidak di new
    for (const s of oldSessions) {
        if (!newKeys.has(toKey(s))) {
            events.push({ type: 'logout', user: s.user, ip: s.ip });
        }
    }

    for (const ev of events) {
        await pool.query(
            'INSERT INTO ssh_events (server_id, event_type, username, ip_address) VALUES ($1,$2,$3,$4)',
            [serverId, ev.type, ev.user, ev.ip]
        );
        console.log(`[SSH] ${ev.type.toUpperCase()} server=${serverId} user=${ev.user} ip=${ev.ip}`);
    }
}

// GET /api/metrics/:serverId?period=1h|6h|24h|7d
router.get('/:serverId', async (req, res) => {
    const period = req.query.period || '1h';
    const intervals = { '1h': '1 hour', '6h': '6 hours', '24h': '24 hours', '7d': '7 days' };
    const interval  = intervals[period] || '1 hour';

    // Downsample: return at most ~200 points
    const buckets = { '1h': '30 seconds', '6h': '3 minutes', '24h': '8 minutes', '7d': '1 hour' };
    const bucket  = buckets[period] || '30 seconds';

    try {
        const result = await pool.query(
            `SELECT
                date_trunc('minute', recorded_at) +
                    (EXTRACT(EPOCH FROM recorded_at - date_trunc('minute', recorded_at))::int
                     / EXTRACT(EPOCH FROM INTERVAL '${bucket}')::int)
                    * INTERVAL '${bucket}' AS ts,
                ROUND(AVG(cpu_usage)::numeric, 2)                                AS cpu_usage,
                ROUND(AVG(ram_used)::numeric, 0)                                 AS ram_used,
                ROUND(AVG(ram_total)::numeric, 0)                                AS ram_total,
                ROUND(AVG(disk_used)::numeric, 0)                                AS disk_used,
                ROUND(AVG(disk_total)::numeric, 0)                               AS disk_total,
                MAX(net_rx_bytes)                                                 AS net_rx_bytes,
                MAX(net_tx_bytes)                                                 AS net_tx_bytes,
                ROUND(AVG(load_1)::numeric, 2)                                   AS load_1
             FROM metrics
             WHERE server_id = $1 AND recorded_at > NOW() - INTERVAL '${interval}'
             GROUP BY ts
             ORDER BY ts ASC`,
            [req.params.serverId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/metrics/:serverId/latest
router.get('/:serverId/latest', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM metrics WHERE server_id = $1 ORDER BY recorded_at DESC LIMIT 1',
            [req.params.serverId]
        );
        res.json(result.rows[0] || null);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
