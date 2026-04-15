const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

// GET /api/thresholds/:serverId
router.get('/:serverId', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM thresholds WHERE server_id = $1 ORDER BY metric',
            [req.params.serverId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/thresholds/:serverId — update thresholds
// Body: array of { metric, warning_pct, critical_pct, cooldown_seconds, enabled }
router.put('/:serverId', async (req, res) => {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Body must be array' });

    try {
        for (const item of items) {
            await pool.query(
                `INSERT INTO thresholds (server_id, metric, warning_pct, critical_pct, cooldown_seconds, enabled)
                 VALUES ($1,$2,$3,$4,$5,$6)
                 ON CONFLICT (server_id, metric)
                 DO UPDATE SET
                    warning_pct      = EXCLUDED.warning_pct,
                    critical_pct     = EXCLUDED.critical_pct,
                    cooldown_seconds = EXCLUDED.cooldown_seconds,
                    enabled          = EXCLUDED.enabled`,
                [
                    req.params.serverId,
                    item.metric,
                    parseFloat(item.warning_pct)  || 80,
                    parseFloat(item.critical_pct) || 90,
                    parseInt(item.cooldown_seconds) || 300,
                    item.enabled !== false,
                ]
            );
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
