const pool = require('../db/pool');

// Agent auth: validate X-API-Key, returns server row
async function agentAuth(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: 'Missing X-API-Key header' });

    try {
        const result = await pool.query('SELECT * FROM servers WHERE api_key = $1', [apiKey]);
        if (result.rows.length === 0) return res.status(403).json({ error: 'Invalid API key' });
        req.server = result.rows[0];
        next();
    } catch (err) {
        res.status(500).json({ error: 'Auth error' });
    }
}

// Admin auth: validate X-Admin-Token for management routes
function adminAuth(req, res, next) {
    const token = req.headers['x-admin-token'];
    if (!token || token !== process.env.ADMIN_TOKEN) {
        return res.status(403).json({ error: 'Invalid admin token' });
    }
    next();
}

module.exports = { agentAuth, adminAuth };
