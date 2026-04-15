import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getServer, getMetrics, getLatestMetric, getThresholds, updateThresholds, getAlerts } from '../api'
import MetricChart from '../components/MetricChart'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

function fmtBytes(b) {
    if (!b) return '0 B'
    const u = ['B','KB','MB','GB','TB']; let v=b,i=0
    while(v>=1024&&i<u.length-1){v/=1024;i++}
    return `${v.toFixed(1)} ${u[i]}`
}

function fmtUptime(sec) {
    if (!sec) return '-'
    const d=Math.floor(sec/86400), h=Math.floor((sec%86400)/3600), m=Math.floor((sec%3600)/60)
    if (d>0) return `${d}h ${h}j ${m}m`
    if (h>0) return `${h}j ${m}m`
    return `${m}m`
}

function prepareNetData(data) {
    return data.map((d, i) => {
        if (i === 0) return { ...d, net_rx_rate: 0, net_tx_rate: 0 }
        const prev = data[i-1]
        const dt   = (new Date(d.ts) - new Date(prev.ts)) / 1000 || 30
        return {
            ...d,
            net_rx_rate: Math.max(0, ((d.net_rx_bytes - prev.net_rx_bytes) / dt) / 1024 / 1024),
            net_tx_rate: Math.max(0, ((d.net_tx_bytes - prev.net_tx_bytes) / dt) / 1024 / 1024),
        }
    })
}

function prepareRamData(data) {
    return data.map(d => ({
        ...d,
        ram_pct: d.ram_total > 0 ? ((d.ram_used / d.ram_total) * 100).toFixed(2) : 0,
    }))
}

const PERIODS = ['1h','6h','24h','7d']

export default function ServerDetail() {
    const { id }   = useParams()
    const navigate = useNavigate()

    const [server,     setServer]     = useState(null)
    const [latest,     setLatest]     = useState(null)
    const [metrics,    setMetrics]    = useState([])
    const [period,     setPeriod]     = useState('1h')
    const [thresholds, setThresholds] = useState([])
    const [alerts,     setAlerts]     = useState([])
    const [loading,    setLoading]    = useState(true)
    const [savingTh,   setSavingTh]   = useState(false)
    const [thForm,     setThForm]     = useState({})

    const load = useCallback(async () => {
        try {
            const [srv, lat, m, th, al] = await Promise.all([
                getServer(id),
                getLatestMetric(id),
                getMetrics(id, period),
                getThresholds(id),
                getAlerts({ serverId: id, limit: 20 }),
            ])
            setServer(srv)
            setLatest(lat)
            setMetrics(m)
            setThresholds(th)
            setAlerts(al)
            // Init threshold form
            const form = {}
            th.forEach(t => { form[t.metric] = { ...t } })
            setThForm(form)
        } catch(e) { console.error(e) }
        finally { setLoading(false) }
    }, [id, period])

    useEffect(() => { load() }, [load])
    useEffect(() => {
        const t = setInterval(load, 15000)
        return () => clearInterval(t)
    }, [load])

    async function saveThresholds() {
        setSavingTh(true)
        try {
            await updateThresholds(id, Object.values(thForm))
            alert('Threshold disimpan!')
        } catch(e) { alert('Gagal menyimpan') }
        finally { setSavingTh(false) }
    }

    if (loading) return <div className="page"><div className="empty-state"><div className="spinner" /></div></div>
    if (!server)  return <div className="page"><div className="empty-state"><p>Server tidak ditemukan.</p></div></div>

    const netData  = prepareNetData(metrics)
    const ramData  = prepareRamData(metrics)
    const cpuPct   = Math.round(parseFloat(latest?.cpu_usage) || 0)
    const ramPct   = latest?.ram_total > 0 ? Math.round((latest.ram_used / latest.ram_total) * 100) : 0
    const diskPct  = latest?.disk_total > 0 ? Math.round((latest.disk_used / latest.disk_total) * 100) : 0
    const online   = server.last_seen && (Date.now() - new Date(server.last_seen).getTime()) < 3*60*1000

    return (
        <div className="page">
            {/* Header */}
            <div className="flex items-center gap-12 mb-16">
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
                <div style={{ flex:1 }}>
                    <div className="flex items-center gap-8">
                        <div className="page-title">{server.name}</div>
                        <div className={`status-dot ${online ? 'online' : 'offline'}`} />
                        <span className="text-muted text-sm">{online ? 'Online' : 'Offline'}</span>
                        {latest?.ping_ms > 0 && (
                            <span className="badge blue" style={{ fontSize: 11 }}>
                                🏓 {parseFloat(latest.ping_ms).toFixed(1)} ms
                            </span>
                        )}
                    </div>
                    <div className="page-sub">{server.hostname} · {server.type?.toUpperCase()}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={load}>🔄 Refresh</button>
            </div>

            {/* Quick stats */}
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                {[
                    { label: 'CPU',     val: `${cpuPct}%` },
                    { label: 'RAM',     val: `${ramPct}%` },
                    { label: 'Disk',    val: `${diskPct}%` },
                    { label: 'Load 1m', val: latest?.load_1 ?? '-' },
                    { label: 'Uptime',  val: fmtUptime(latest?.uptime_seconds) },
                    { label: 'Proses',  val: latest?.process_count ?? '-' },
                    { label: 'SSH Aktif', val: latest?.active_sessions ?? '-' },
                    { label: 'Ping',    val: latest?.ping_ms > 0 ? `${parseFloat(latest.ping_ms).toFixed(1)} ms` : '-' },
                ].map(s => (
                    <div key={s.label} className="stat-card">
                        <div className="stat-label">{s.label}</div>
                        <div className="stat-value" style={{ fontSize: 22 }}>{s.val}</div>
                    </div>
                ))}
            </div>

            {/* Period picker */}
            <div className="period-pills">
                {PERIODS.map(p => (
                    <button key={p} className={`period-pill${period===p?' active':''}`} onClick={() => setPeriod(p)}>{p}</button>
                ))}
            </div>

            {/* Charts */}
            <div className="charts-grid">
                <MetricChart title="CPU Usage (%)" data={metrics} dataKey="cpu_usage" unit="%" color="#3b82f6" yDomain={[0,100]} />
                <MetricChart title="RAM Usage (%)" data={ramData}  dataKey="ram_pct"  unit="%" color="#a855f7" yDomain={[0,100]} />
                <MetricChart title="Disk Usage (%)" data={metrics.map(d=>({...d, disk_pct: d.disk_total>0?((d.disk_used/d.disk_total)*100).toFixed(2):0}))} dataKey="disk_pct" unit="%" color="#f59e0b" yDomain={[0,100]} />
                <MetricChart
                    title="Network (MB/s)"
                    data={netData}
                    dataKey={[{ key: 'net_rx_rate', label: 'RX', color: '#22c55e' }, { key: 'net_tx_rate', label: 'TX', color: '#ef4444' }]}
                    unit=" MB/s"
                />
            </div>

            {/* Thresholds */}
            <div className="card mb-16">
                <div className="card-title">⚙️ Threshold Alert</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                    {['cpu','ram','disk'].map(m => {
                        const th = thForm[m] || { metric: m, warning_pct: 80, critical_pct: 90, cooldown_seconds: 300, enabled: true }
                        return (
                            <div key={m} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '14px' }}>
                                <div style={{ fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', fontSize: 12, color: 'var(--muted)' }}>
                                    {m}
                                    <input type="checkbox" style={{ float: 'right', cursor: 'pointer' }}
                                        checked={th.enabled !== false}
                                        onChange={e => setThForm(f => ({ ...f, [m]: { ...f[m]||th, enabled: e.target.checked } }))}
                                    />
                                </div>
                                <div className="form-row">
                                    <div>
                                        <div className="form-label">Warning (%)</div>
                                        <input type="number" className="form-input" min="1" max="100"
                                            value={th.warning_pct}
                                            onChange={e => setThForm(f => ({ ...f, [m]: { ...f[m]||th, warning_pct: e.target.value } }))}
                                        />
                                    </div>
                                    <div>
                                        <div className="form-label">Critical (%)</div>
                                        <input type="number" className="form-input" min="1" max="100"
                                            value={th.critical_pct}
                                            onChange={e => setThForm(f => ({ ...f, [m]: { ...f[m]||th, critical_pct: e.target.value } }))}
                                        />
                                    </div>
                                </div>
                                <div className="form-group mt-8">
                                    <div className="form-label">Cooldown (detik)</div>
                                    <input type="number" className="form-input" min="60"
                                        value={th.cooldown_seconds ?? 300}
                                        onChange={e => setThForm(f => ({ ...f, [m]: { ...f[m]||th, cooldown_seconds: e.target.value } }))}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
                <div style={{ marginTop: 14 }}>
                    <button className="btn btn-primary btn-sm" onClick={saveThresholds} disabled={savingTh}>
                        {savingTh ? '...' : '💾 Simpan Threshold'}
                    </button>
                </div>
            </div>

            {/* Recent alerts */}
            <div className="card">
                <div className="card-title">🔔 Alert Terbaru</div>
                {alerts.length === 0 ? (
                    <div className="text-muted text-sm">Tidak ada alert.</div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr><th>Waktu</th><th>Metrik</th><th>Level</th><th>Nilai</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                {alerts.map(a => (
                                    <tr key={a.id} className={`alert-row ${a.level} ${a.acknowledged ? 'acked' : ''}`}>
                                        <td className="text-sm text-muted">{new Date(a.created_at).toLocaleString('id-ID')}</td>
                                        <td style={{ textTransform: 'uppercase', fontSize: 12 }}>{a.metric}</td>
                                        <td><span className={`badge ${a.level}`}>{a.level}</span></td>
                                        <td>{parseFloat(a.value).toFixed(1)}%</td>
                                        <td>{a.acknowledged ? <span className="badge gray">Acked</span> : <span className="badge ok">New</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
