const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

// GET /api/dashboard — summary stats
router.get('/', async (req, res) => {
    try {
        const serverCount = await pool.query('SELECT COUNT(*) FROM servers');
        const alertCount  = await pool.query(
            "SELECT COUNT(*) FROM alerts WHERE acknowledged = FALSE AND created_at > NOW() - INTERVAL '24 hours'"
        );
        const critCount   = await pool.query(
            "SELECT COUNT(*) FROM alerts WHERE acknowledged = FALSE AND level = 'critical' AND created_at > NOW() - INTERVAL '24 hours'"
        );

        // Online = last_seen within 3 minutes
        const onlineCount = await pool.query(
            "SELECT COUNT(*) FROM servers WHERE last_seen > NOW() - INTERVAL '3 minutes'"
        );

        res.json({
            total_servers:   parseInt(serverCount.rows[0].count),
            online_servers:  parseInt(onlineCount.rows[0].count),
            active_alerts:   parseInt(alertCount.rows[0].count),
            critical_alerts: parseInt(critCount.rows[0].count),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
