require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const cron     = require('node-cron');
const pool     = require('./db/pool');

const metricsRouter    = require('./routes/metrics');
const serversRouter    = require('./routes/servers');
const alertsRouter     = require('./routes/alerts');
const thresholdsRouter = require('./routes/thresholds');
const telegramRouter   = require('./routes/telegram');
const dashboardRouter  = require('./routes/dashboard');
const { pollMikrotikServers } = require('./services/mikrotik');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000');

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/metrics',    metricsRouter);
app.use('/api/servers',    serversRouter);
app.use('/api/alerts',     alertsRouter);
app.use('/api/thresholds', thresholdsRouter);
app.use('/api/telegram',   telegramRouter);
app.use('/api/dashboard',  dashboardRouter);

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Cron: poll Mikrotik servers every 30 seconds
cron.schedule('*/30 * * * * *', () => {
    pollMikrotikServers().catch(err =>
        console.error('[Cron] Mikrotik poll error:', err.message)
    );
});

// Cron: prune old metrics (keep 7 days) — runs daily at 02:00
cron.schedule('0 2 * * *', async () => {
    try {
        const res = await pool.query(
            "DELETE FROM metrics WHERE recorded_at < NOW() - INTERVAL '7 days'"
        );
        console.log(`[Cron] Pruned ${res.rowCount} old metrics`);
    } catch (err) {
        console.error('[Cron] Prune error:', err.message);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`NMS-PBG Backend running on port ${PORT}`);
    console.log(`Admin token: ${process.env.ADMIN_TOKEN ? '(set)' : '(NOT SET — check .env!)'}`);
});
