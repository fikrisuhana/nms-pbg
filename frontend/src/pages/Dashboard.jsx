import { useEffect, useState } from 'react'
import { getDashboard, getServers } from '../api'
import ServerCard from '../components/ServerCard'

export default function Dashboard() {
    const [stats,   setStats]   = useState(null)
    const [servers, setServers] = useState([])
    const [loading, setLoading] = useState(true)

    async function load() {
        try {
            const [s, srv] = await Promise.all([getDashboard(), getServers()])
            setStats(s)
            setServers(srv)
        } catch(e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        const t = setInterval(load, 15000) // refresh every 15s
        return () => clearInterval(t)
    }, [])

    return (
        <div className="page">
            <div className="page-header flex items-center justify-between">
                <div>
                    <div className="page-title">Dashboard</div>
                    <div className="page-sub">Overview semua server yang dimonitor</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={load}>
                    🔄 Refresh
                </button>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner" /><p style={{marginTop:12}}>Memuat...</p></div>
            ) : (
                <>
                    <div className="stat-grid">
                        <div className="stat-card">
                            <div className="stat-label">Total Server</div>
                            <div className="stat-value blue">{stats?.total_servers ?? 0}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Online</div>
                            <div className="stat-value green">{stats?.online_servers ?? 0}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Alert Aktif (24h)</div>
                            <div className={`stat-value ${(stats?.active_alerts ?? 0) > 0 ? 'yellow' : 'green'}`}>
                                {stats?.active_alerts ?? 0}
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">Critical Alerts</div>
                            <div className={`stat-value ${(stats?.critical_alerts ?? 0) > 0 ? 'red' : 'green'}`}>
                                {stats?.critical_alerts ?? 0}
                            </div>
                        </div>
                    </div>

                    {servers.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">🖥️</div>
                            <p>Belum ada server. Tambah di menu <strong>Settings</strong>.</p>
                        </div>
                    ) : (
                        <div className="server-grid">
                            {servers.map(s => <ServerCard key={s.id} server={s} />)}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
