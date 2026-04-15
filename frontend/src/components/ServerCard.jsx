import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

function pct(used, total) {
    if (!total || total === 0) return 0
    return Math.round((used / total) * 100)
}

function barClass(val) {
    if (val >= 90) return 'critical'
    if (val >= 75) return 'warning'
    return 'ok'
}

function fmtBytes(bytes) {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let v = bytes, i = 0
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
    return `${v.toFixed(1)} ${units[i]}`
}

function isOnline(lastSeen) {
    if (!lastSeen) return false
    return (Date.now() - new Date(lastSeen).getTime()) < 3 * 60 * 1000
}

export default function ServerCard({ server }) {
    const navigate = useNavigate()
    const online   = isOnline(server.last_seen)
    const ramPct   = pct(server.ram_used, server.ram_total)
    const diskPct  = pct(server.disk_used, server.disk_total)
    const cpuPct   = Math.round(parseFloat(server.cpu_usage) || 0)

    const lastSeen = server.last_seen
        ? formatDistanceToNow(new Date(server.last_seen), { addSuffix: true, locale: localeId })
        : 'Belum pernah'

    return (
        <div className="server-card" onClick={() => navigate(`/servers/${server.id}`)}>
            <div className="server-card-header">
                <div>
                    <div className="server-name">{server.name}</div>
                    <div className="server-host">{server.hostname || server.type?.toUpperCase()}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="text-sm text-muted">{online ? 'Online' : 'Offline'}</span>
                    <div className={`status-dot ${online ? 'online' : 'offline'}`} />
                </div>
            </div>

            <div className="metric-row">
                <span className="metric-label">CPU</span>
                <span className="metric-val" style={{ color: cpuPct >= 90 ? 'var(--red)' : cpuPct >= 75 ? 'var(--yellow)' : 'var(--text)' }}>
                    {cpuPct}%
                </span>
            </div>
            <div className="progress-bar-wrap">
                <div className={`progress-bar ${barClass(cpuPct)}`} style={{ width: `${cpuPct}%` }} />
            </div>

            <div className="metric-row mt-8">
                <span className="metric-label">RAM</span>
                <span className="metric-val">{fmtBytes(server.ram_used)} / {fmtBytes(server.ram_total)} ({ramPct}%)</span>
            </div>
            <div className="progress-bar-wrap">
                <div className={`progress-bar ${barClass(ramPct)}`} style={{ width: `${ramPct}%` }} />
            </div>

            <div className="metric-row mt-8">
                <span className="metric-label">Disk</span>
                <span className="metric-val">{fmtBytes(server.disk_used)} / {fmtBytes(server.disk_total)} ({diskPct}%)</span>
            </div>
            <div className="progress-bar-wrap">
                <div className={`progress-bar ${barClass(diskPct)}`} style={{ width: `${diskPct}%` }} />
            </div>

            <div className="metric-row mt-8">
                <span className="metric-label">Last seen</span>
                <span className="text-muted text-sm">{lastSeen}</span>
            </div>
        </div>
    )
}
