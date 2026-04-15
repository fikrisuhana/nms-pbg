import { useEffect, useState } from 'react'
import { getAlerts, ackAlert, ackAll, getServers } from '../api'

export default function Alerts() {
    const [alerts,  setAlerts]  = useState([])
    const [servers, setServers] = useState([])
    const [filter,  setFilter]  = useState({ serverId: '', level: '', unacked: '' })
    const [loading, setLoading] = useState(true)

    async function load() {
        setLoading(true)
        try {
            const params = {}
            if (filter.serverId) params.serverId = filter.serverId
            if (filter.level)    params.level    = filter.level
            if (filter.unacked)  params.unacked  = 'true'
            params.limit = 200
            const [al, srv] = await Promise.all([getAlerts(params), getServers()])
            setAlerts(al)
            setServers(srv)
        } catch(e) { console.error(e) }
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [filter])

    async function handleAck(id) {
        await ackAlert(id)
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a))
    }

    async function handleAckAll() {
        await ackAll(filter.serverId || undefined)
        load()
    }

    const unackedCount = alerts.filter(a => !a.acknowledged).length

    return (
        <div className="page">
            <div className="page-header flex items-center justify-between">
                <div>
                    <div className="page-title">Alerts</div>
                    <div className="page-sub">{unackedCount} alert belum dibaca</div>
                </div>
                <div className="flex gap-8">
                    <button className="btn btn-ghost btn-sm" onClick={handleAckAll}>✅ Ack Semua</button>
                    <button className="btn btn-ghost btn-sm" onClick={load}>🔄 Refresh</button>
                </div>
            </div>

            {/* Filter */}
            <div className="card mb-16">
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                        <div className="form-label">Server</div>
                        <select className="form-input" style={{ width: 180 }}
                            value={filter.serverId}
                            onChange={e => setFilter(f => ({ ...f, serverId: e.target.value }))}>
                            <option value="">Semua Server</option>
                            {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <div className="form-label">Level</div>
                        <select className="form-input" style={{ width: 140 }}
                            value={filter.level}
                            onChange={e => setFilter(f => ({ ...f, level: e.target.value }))}>
                            <option value="">Semua</option>
                            <option value="critical">Critical</option>
                            <option value="warning">Warning</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input type="checkbox" checked={!!filter.unacked}
                                onChange={e => setFilter(f => ({ ...f, unacked: e.target.checked ? 'true' : '' }))} />
                            <span className="form-label" style={{ margin: 0 }}>Belum di-ack saja</span>
                        </label>
                    </div>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div className="empty-state"><div className="spinner" /></div>
                ) : alerts.length === 0 ? (
                    <div className="empty-state"><div className="icon">✅</div><p>Tidak ada alert ditemukan.</p></div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Waktu</th><th>Server</th><th>Metrik</th><th>Level</th>
                                    <th>Nilai</th><th>Threshold</th><th>Telegram</th><th>Status</th><th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {alerts.map(a => (
                                    <tr key={a.id} className={`alert-row ${a.level} ${a.acknowledged ? 'acked' : ''}`}>
                                        <td className="text-sm">{new Date(a.created_at).toLocaleString('id-ID')}</td>
                                        <td style={{ fontWeight: 600 }}>{a.server_name}</td>
                                        <td style={{ textTransform: 'uppercase', fontSize: 12 }}>{a.metric}</td>
                                        <td><span className={`badge ${a.level}`}>{a.level}</span></td>
                                        <td>{parseFloat(a.value).toFixed(1)}%</td>
                                        <td>{parseFloat(a.threshold_pct).toFixed(0)}%</td>
                                        <td>{a.telegram_sent ? '✅' : '❌'}</td>
                                        <td>
                                            {a.acknowledged
                                                ? <span className="badge gray">Acked</span>
                                                : <span className="badge ok">New</span>}
                                        </td>
                                        <td>
                                            {!a.acknowledged && (
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleAck(a.id)}>Ack</button>
                                            )}
                                        </td>
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
