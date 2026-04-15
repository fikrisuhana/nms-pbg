const pool    = require('../db/pool');
const telegram = require('./telegram');

// Check metric value against thresholds, fire alert if needed
async function checkThresholds(server, metric) {
    // metric = { cpu_usage, ram_used, ram_total, disk_used, disk_total, net_rx_bytes, net_tx_bytes }
    const rows = await pool.query(
        'SELECT * FROM thresholds WHERE server_id = $1 AND enabled = TRUE',
        [server.id]
    );
    const thresholds = rows.rows;

    const checks = [
        {
            key:   'cpu',
            label: 'CPU',
            value: metric.cpu_usage,
            unit:  '%',
        },
        {
            key:   'ram',
            label: 'RAM',
            value: metric.ram_total > 0 ? (metric.ram_used / metric.ram_total) * 100 : null,
            unit:  '%',
        },
        {
            key:   'disk',
            label: 'Disk',
            value: metric.disk_total > 0 ? (metric.disk_used / metric.disk_total) * 100 : null,
            unit:  '%',
        },
    ];

    for (const check of checks) {
        if (check.value === null || check.value === undefined) continue;

        const th = thresholds.find(t => t.metric === check.key);
        if (!th) continue;

        let level = null;
        if (check.value >= th.critical_pct) level = 'critical';
        else if (check.value >= th.warning_pct) level = 'warning';

        if (!level) continue;

        // Cooldown check: skip if alert already sent within cooldown window
        const cooldownAgo = new Date(Date.now() - th.cooldown_seconds * 1000);
        const recent = await pool.query(
            `SELECT id FROM alerts
             WHERE server_id = $1 AND metric = $2 AND level = $3
               AND created_at > $4
             LIMIT 1`,
            [server.id, check.key, level, cooldownAgo]
        );
        if (recent.rows.length > 0) continue;

        const msg = `⚠️ <b>[${level.toUpperCase()}] ${server.name}</b>\n` +
                    `Metrik: ${check.label}\n` +
                    `Nilai: ${check.value.toFixed(1)}${check.unit} (threshold: ${level === 'critical' ? th.critical_pct : th.warning_pct}${check.unit})`;

        const sent = await telegram.sendMessage(msg);

        await pool.query(
            `INSERT INTO alerts (server_id, metric, level, value, threshold_pct, message, telegram_sent)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                server.id,
                check.key,
                level,
                check.value.toFixed(2),
                level === 'critical' ? th.critical_pct : th.warning_pct,
                msg,
                sent,
            ]
        );
    }
}

// Insert default thresholds for a new server
async function insertDefaultThresholds(serverId) {
    const defaults = [
        { metric: 'cpu',  warning: 80, critical: 90 },
        { metric: 'ram',  warning: 80, critical: 90 },
        { metric: 'disk', warning: 80, critical: 90 },
    ];
    for (const d of defaults) {
        await pool.query(
            `INSERT INTO thresholds (server_id, metric, warning_pct, critical_pct)
             VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
            [serverId, d.metric, d.warning, d.critical]
        );
    }
}

module.exports = { checkThresholds, insertDefaultThresholds };
