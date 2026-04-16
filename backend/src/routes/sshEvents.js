const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

// GET /api/ssh-events/:serverId?limit=50
router.get('/:serverId', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    try {
        const result = await pool.query(
            `SELECT id, event_type, username, ip_address, created_at
             FROM ssh_events
             WHERE server_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [req.params.serverId, limit]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
