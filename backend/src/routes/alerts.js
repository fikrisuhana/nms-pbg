const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

// GET /api/alerts?serverId=&level=&unacked=true&limit=50
router.get('/', async (req, res) => {
    const { serverId, level, unacked, limit = 100 } = req.query;
    let where = ['1=1'];
    const params = [];

    if (serverId) { params.push(serverId); where.push(`a.server_id = $${params.length}`); }
    if (level)    { params.push(level);    where.push(`a.level = $${params.length}`); }
    if (unacked === 'true') where.push('a.acknowledged = FALSE');

    params.push(parseInt(limit) || 100);

    try {
        const result = await pool.query(
            `SELECT a.*, s.name AS server_name
             FROM alerts a
             JOIN servers s ON s.id = a.server_id
             WHERE ${where.join(' AND ')}
             ORDER BY a.created_at DESC
             LIMIT $${params.length}`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/alerts/:id/ack
router.patch('/:id/ack', async (req, res) => {
    try {
        await pool.query(
            'UPDATE alerts SET acknowledged = TRUE, acknowledged_at = NOW() WHERE id = $1',
            [req.params.id]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/alerts/ack-all — ack semua
router.patch('/ack-all', async (req, res) => {
    const { serverId } = req.body;
    try {
        let q = 'UPDATE alerts SET acknowledged = TRUE, acknowledged_at = NOW() WHERE acknowledged = FALSE';
        const p = [];
        if (serverId) { p.push(serverId); q += ` AND server_id = $1`; }
        await pool.query(q, p);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
