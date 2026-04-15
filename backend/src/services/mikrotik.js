const axios          = require('axios');
const { RouterOSAPI } = require('node-routeros');
const pool           = require('../db/pool');
const threshold      = require('./threshold');

async function pollMikrotikServers() {
    const result = await pool.query(
        "SELECT * FROM servers WHERE type = 'mikrotik' AND mikrotik_host IS NOT NULL"
    );
    for (const server of result.rows) {
        try {
            await pollOne(server);
        } catch (err) {
            console.error(`[Mikrotik] Poll failed for ${server.name}:`, err.message);
        }
    }
}

async function pollOne(server) {
    const apiType = server.mikrotik_api_type || 'rest';
    const metric  = apiType === 'api'
        ? await pollViaApi(server)
        : await pollViaRest(server);

    await pool.query(
        `INSERT INTO metrics
            (server_id, cpu_usage, ram_used, ram_total, disk_used, disk_total,
             net_rx_bytes, net_tx_bytes, uptime_seconds)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
            server.id,
            metric.cpu_usage, metric.ram_used,  metric.ram_total,
            metric.disk_used, metric.disk_total,
            metric.net_rx_bytes, metric.net_tx_bytes,
            metric.uptime_seconds,
        ]
    );

    await pool.query('UPDATE servers SET last_seen = NOW() WHERE id = $1', [server.id]);
    await threshold.checkThresholds(server, metric);
}

// ── REST API (RouterOS v7+, port 80) ────────────────────────────────────────

async function pollViaRest(server) {
    const base = `http://${server.mikrotik_host}:${server.mikrotik_port || 80}/rest`;
    const auth = { username: server.mikrotik_user, password: server.mikrotik_pass };
    const opts = { auth, timeout: 8000 };

    const resRes = await axios.get(`${base}/system/resource`, opts);
    const res    = resRes.data;

    const cpuLoad   = parseFloat(res['cpu-load'])       || 0;
    const totalMem  = parseInt(res['total-memory'])     || 0;
    const freeMem   = parseInt(res['free-memory'])      || 0;
    const totalDisk = parseInt(res['total-hdd-space'])  || 0;
    const freeDisk  = parseInt(res['free-hdd-space'])   || 0;
    const uptime    = parseMikrotikUptime(res['uptime'] || '');

    let rxBytes = 0, txBytes = 0;
    try {
        const ifRes  = await axios.get(`${base}/interface`, opts);
        const ifaces = Array.isArray(ifRes.data) ? ifRes.data : [];
        const primary = ifaces.find(i => i.name === 'ether1' && i.running === 'true')
                     || ifaces.find(i => i.running === 'true');
        if (primary) {
            rxBytes = parseInt(primary['rx-byte']) || 0;
            txBytes = parseInt(primary['tx-byte']) || 0;
        }
    } catch (_) {}

    return buildMetric(cpuLoad, totalMem, freeMem, totalDisk, freeDisk, rxBytes, txBytes, uptime);
}

// ── Binary API (RouterOS v6+, port 8728) ────────────────────────────────────

async function pollViaApi(server) {
    const conn = new RouterOSAPI({
        host:     server.mikrotik_host,
        user:     server.mikrotik_user,
        password: server.mikrotik_pass,
        port:     parseInt(server.mikrotik_port) || 8728,
        timeout:  8,
    });

    const client = await conn.connect();
    try {
        const resources  = await client.write('/system/resource/print');
        const interfaces = await client.write('/interface/print').catch(() => []);

        const res       = (Array.isArray(resources) ? resources[0] : resources) || {};
        const cpuLoad   = parseFloat(res['cpu-load'])      || 0;
        const totalMem  = parseInt(res['total-memory'])    || 0;
        const freeMem   = parseInt(res['free-memory'])     || 0;
        const totalDisk = parseInt(res['total-hdd-space']) || 0;
        const freeDisk  = parseInt(res['free-hdd-space'])  || 0;
        const uptime    = parseMikrotikUptime(res['uptime'] || '');

        const ifaces  = Array.isArray(interfaces) ? interfaces : [];
        const primary = ifaces.find(i => i.name === 'ether1' && i.running === 'true')
                     || ifaces.find(i => i.running === 'true');
        const rxBytes = primary ? parseInt(primary['rx-byte']) || 0 : 0;
        const txBytes = primary ? parseInt(primary['tx-byte']) || 0 : 0;

        return buildMetric(cpuLoad, totalMem, freeMem, totalDisk, freeDisk, rxBytes, txBytes, uptime);
    } finally {
        conn.close();
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildMetric(cpuLoad, totalMem, freeMem, totalDisk, freeDisk, rxBytes, txBytes, uptime) {
    return {
        cpu_usage:      cpuLoad,
        ram_used:       totalMem - freeMem,
        ram_total:      totalMem,
        disk_used:      totalDisk - freeDisk,
        disk_total:     totalDisk,
        net_rx_bytes:   rxBytes,
        net_tx_bytes:   txBytes,
        uptime_seconds: uptime,
    };
}

function parseMikrotikUptime(str) {
    let s = 0;
    const w  = str.match(/(\d+)w/);  if (w)  s += parseInt(w[1])  * 604800;
    const d  = str.match(/(\d+)d/);  if (d)  s += parseInt(d[1])  * 86400;
    const h  = str.match(/(\d+)h/);  if (h)  s += parseInt(h[1])  * 3600;
    const m  = str.match(/(\d+)m/);  if (m)  s += parseInt(m[1])  * 60;
    const sc = str.match(/(\d+)s/);  if (sc) s += parseInt(sc[1]);
    return s;
}

module.exports = { pollMikrotikServers };
