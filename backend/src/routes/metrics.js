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
        await pool.query(
            `INSERT INTO metrics
                (server_id, cpu_usage, ram_used, ram_total, disk_used, disk_total,
                 net_rx_bytes, net_tx_bytes, load_1, load_5, load_15, uptime_seconds, process_count)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
                server.id,
                parseFloat(b.cpu_usage)    || 0,
                parseInt(b.ram_used)       || 0,
                parseInt(b.ram_total)      || 0,
                parseInt(b.disk_used)      || 0,
                parseInt(b.disk_total)     || 0,
                parseInt(b.net_rx_bytes)   || 0,
                parseInt(b.net_tx_bytes)   || 0,
                parseFloat(b.load_1)       || 0,
                parseFloat(b.load_5)       || 0,
                parseFloat(b.load_15)      || 0,
                parseInt(b.uptime_seconds) || 0,
                parseInt(b.process_count)  || 0,
            ]
        );

        await pool.query('UPDATE servers SET last_seen = NOW() WHERE id = $1', [server.id]);

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
