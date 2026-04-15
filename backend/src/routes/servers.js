const express   = require('express');
const router    = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool      = require('../db/pool');
const { adminAuth } = require('../middleware/auth');
const { insertDefaultThresholds } = require('../services/threshold');

// GET /api/servers
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT s.id, s.name, s.hostname, s.description, s.type, s.last_seen, s.created_at,
                    m.cpu_usage, m.ram_used, m.ram_total, m.disk_used, m.disk_total,
                    m.net_rx_bytes, m.net_tx_bytes, m.uptime_seconds, m.recorded_at AS metric_at
             FROM servers s
             LEFT JOIN LATERAL (
                 SELECT * FROM metrics WHERE server_id = s.id ORDER BY recorded_at DESC LIMIT 1
             ) m ON TRUE
             ORDER BY s.name`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/servers/:id
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, hostname, description, type, api_key, last_seen, created_at FROM servers WHERE id = $1',
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/servers — tambah server baru
router.post('/', adminAuth, async (req, res) => {
    const { name, hostname, description, type, mikrotik_host, mikrotik_user, mikrotik_pass, mikrotik_port } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const apiKey = uuidv4();
    const stype  = type === 'mikrotik' ? 'mikrotik' : 'linux';

    try {
        const result = await pool.query(
            `INSERT INTO servers (name, hostname, description, type, api_key, mikrotik_host, mikrotik_user, mikrotik_pass, mikrotik_port)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [name, hostname || null, description || null, stype, apiKey,
             mikrotik_host || null, mikrotik_user || null, mikrotik_pass || null,
             parseInt(mikrotik_port) || 80]
        );
        const server = result.rows[0];
        await insertDefaultThresholds(server.id);
        res.status(201).json(server);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/servers/:id
router.put('/:id', adminAuth, async (req, res) => {
    const { name, hostname, description, mikrotik_host, mikrotik_user, mikrotik_pass, mikrotik_port } = req.body;
    try {
        const result = await pool.query(
            `UPDATE servers SET
                name = COALESCE($1, name),
                hostname = COALESCE($2, hostname),
                description = COALESCE($3, description),
                mikrotik_host = COALESCE($4, mikrotik_host),
                mikrotik_user = COALESCE($5, mikrotik_user),
                mikrotik_pass = COALESCE($6, mikrotik_pass),
                mikrotik_port = COALESCE($7, mikrotik_port)
             WHERE id = $8 RETURNING id, name, hostname, description, type, last_seen`,
            [name, hostname, description, mikrotik_host, mikrotik_user, mikrotik_pass,
             mikrotik_port ? parseInt(mikrotik_port) : null, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/servers/:id
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        await pool.query('DELETE FROM servers WHERE id = $1', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
