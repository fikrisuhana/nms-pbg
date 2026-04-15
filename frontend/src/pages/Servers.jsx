import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getServers } from '../api'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

function pct(used, total) {
    if (!total || total === 0) return 0
    return Math.round((used / total) * 100)
}

function barColor(val) {
    if (val >= 90) return 'var(--red)'
    if (val >= 75) return 'var(--yellow)'
    return 'var(--blue)'
}

function fmtBytes(b) {
    if (!b) return '0 B'
    const u = ['B','KB','MB','GB','TB']; let v=b,i=0
    while(v>=1024&&i<u.length-1){v/=1024;i++}
    return `${v.toFixed(1)} ${u[i]}`
}

function isOnline(lastSeen) {
    if (!lastSeen) return false
    return (Date.now() - new Date(lastSeen).getTime()) < 3 * 60 * 1000
}

function MiniBar({ value }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 3, height: 6 }}>
                <div style={{ width: `${Math.min(value, 100)}%`, height: 6, borderRadius: 3, background: barColor(value) }} />
            </div>
            <span style={{ fontSize: 11, minWidth: 32, textAlign: 'right', color: value >= 90 ? 'var(--red)' : value >= 75 ? 'var(--yellow)' : 'var(--text)' }}>
                {value}%
            </span>
        </div>
    )
}

export default function Servers() {
    const [servers, setServers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search,  setSearch]  = useState('')
    const navigate = useNavigate()

    async function load() {
        try {
            const data = await getServers()
            setServers(data)
        } catch(e) { console.error(e) }
        finally { setLoading(false) }
    }

    useEffect(() => {
        load()
        const t = setInterval(load, 15000)
        return () => clearInterval(t)
    }, [])

    const filtered = servers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.hostname || '').toLowerCase().includes(search.toLowerCase())
    )

    const onlineCount = servers.filter(s => isOnline(s.last_seen)).length

    return (
        <div className="page">
            <div className="page-header flex items-center justify-between">
                <div>
                    <div className="page-title">Servers</div>
                    <div className="page-sub">{onlineCount}/{servers.length} server online</div>
                </div>
                <div className="flex gap-8">
                    <input
                        className="form-input"
                        style={{ width: 220 }}
                        placeholder="🔍 Cari server..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <button className="btn btn-ghost btn-sm" onClick={load}>🔄</button>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div className="empty-state"><div className="spinner" /></div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🖥️</div>
                        <p>{search ? 'Tidak ada hasil.' : 'Belum ada server. Tambah di Settings.'}</p>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Server</th>
                                    <th>Status</th>
                                    <th style={{ minWidth: 120 }}>CPU</th>
                                    <th style={{ minWidth: 120 }}>RAM</th>
                                    <th style={{ minWidth: 120 }}>Disk</th>
                                    <th>Ping</th>
                                    <th>SSH</th>
                                    <th>Uptime</th>
                                    <th>Last Seen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(s => {
                                    const online  = isOnline(s.last_seen)
                                    const cpuPct  = Math.round(parseFloat(s.cpu_usage) || 0)
                                    const ramPct  = pct(s.ram_used, s.ram_total)
                                    const diskPct = pct(s.disk_used, s.disk_total)
                                    const uptime  = (() => {
                                        const sec = s.uptime_seconds
                                        if (!sec) return '-'
                                        const d = Math.floor(sec/86400), h = Math.floor((sec%86400)/3600)
                                        return d > 0 ? `${d}h ${h}j` : `${h}j`
                                    })()
                                    const lastSeen = s.last_seen
                                        ? formatDistanceToNow(new Date(s.last_seen), { addSuffix: true, locale: localeId })
                                        : 'Belum pernah'

                                    return (
                                        <tr key={s.id}
                                            onClick={() => navigate(`/servers/${s.id}`)}
                                            style={{ cursor: 'pointer' }}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{s.name}</div>
                                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.hostname || s.type}</div>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-8">
                                                    <div className={`status-dot ${online ? 'online' : 'offline'}`} />
                                                    <span className="text-sm" style={{ color: online ? 'var(--green)' : 'var(--muted)' }}>
                                                        {online ? 'Online' : 'Offline'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td><MiniBar value={cpuPct} /></td>
                                            <td><MiniBar value={ramPct} /></td>
                                            <td><MiniBar value={diskPct} /></td>
                                            <td className="text-sm">
                                                {s.ping_ms > 0
                                                    ? <span style={{ color: s.ping_ms < 10 ? 'var(--green)' : s.ping_ms < 50 ? 'var(--yellow)' : 'var(--red)' }}>
                                                        {parseFloat(s.ping_ms).toFixed(1)} ms
                                                      </span>
                                                    : <span className="text-muted">-</span>
                                                }
                                            </td>
                                            <td className="text-sm text-muted">{s.active_sessions ?? '-'}</td>
                                            <td className="text-sm text-muted">{uptime}</td>
                                            <td className="text-sm text-muted">{lastSeen}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
