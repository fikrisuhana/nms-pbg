import { NavLink, useLocation } from 'react-router-dom'

const navItems = [
    { to: '/',         icon: '📊', label: 'Dashboard' },
    { to: '/servers',  icon: '🖥️', label: 'Servers' },
    { to: '/alerts',   icon: '🔔', label: 'Alerts' },
    { to: '/settings', icon: '⚙️', label: 'Settings' },
]

export default function Layout({ children }) {
    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <span>📡</span> NMS-PBG
                </div>
                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                        >
                            <span className="icon">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--muted)' }}>
                    NMS-PBG v1.0
                </div>
            </aside>
            <main className="main-content">
                {children}
            </main>
        </div>
    )
}
