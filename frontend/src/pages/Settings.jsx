import { useEffect, useState } from 'react'
import { getServers, createServer, deleteServer, getTelegram, updateTelegram, testTelegram } from '../api'

export default function Settings() {
    const [servers,   setServers]   = useState([])
    const [tg,        setTg]        = useState({ bot_token: '', chat_id: '', enabled: false })
    const [newServer, setNewServer] = useState({ name: '', hostname: '', description: '', type: 'linux', mikrotik_host: '', mikrotik_user: '', mikrotik_pass: '', mikrotik_port: 80 })
    const [adminToken, setAdminToken] = useState(localStorage.getItem('nms_admin_token') || '')
    const [msg,       setMsg]       = useState('')
    const [botTokenInput, setBotTokenInput] = useState('')

    async function load() {
        try {
            const [srv, tgConf] = await Promise.all([getServers(), getTelegram()])
            setServers(srv)
            setTg(tgConf || { bot_token: '', chat_id: '', enabled: false })
        } catch(e) { console.error(e) }
    }

    useEffect(() => { load() }, [])

    function saveToken() {
        localStorage.setItem('nms_admin_token', adminToken)
        setMsg('Admin token disimpan di browser.')
        setTimeout(() => setMsg(''), 3000)
    }

    async function handleAddServer(e) {
        e.preventDefault()
        if (!newServer.name) return setMsg('Nama server wajib diisi.')
        try {
            const created = await createServer(newServer)
            setMsg(`✅ Server ditambahkan! API Key: ${created.api_key}`)
            setNewServer({ name:'', hostname:'', description:'', type:'linux', mikrotik_host:'', mikrotik_user:'', mikrotik_pass:'', mikrotik_port:80 })
            load()
        } catch(e) { setMsg('Gagal tambah server: ' + (e.response?.data?.error || e.message)) }
    }

    async function handleDelete(id, name) {
        if (!confirm(`Hapus server "${name}"? Semua metric & alert akan hilang.`)) return
        try {
            await deleteServer(id)
            load()
        } catch(e) { setMsg('Gagal hapus: ' + e.message) }
    }

    async function handleSaveTg(e) {
        e.preventDefault()
        try {
            // Jangan kirim '***' (nilai masked dari GET) sebagai token baru.
            // Kirim string kosong agar backend pakai COALESCE dan tetap pakai token lama.
            const payload = {
                bot_token: botTokenInput || '',
                chat_id:   tg.chat_id,
                enabled:   tg.enabled,
            }
            await updateTelegram(payload)
            setMsg('✅ Konfigurasi Telegram disimpan.')
            setBotTokenInput('')
            setTimeout(() => setMsg(''), 3000)
        } catch(e) { setMsg('Gagal: ' + e.message) }
    }

    async function handleTestTg() {
        try {
            const r = await testTelegram()
            setMsg(r.ok ? '✅ ' + r.message : '❌ ' + r.message)
        } catch(e) { setMsg('Gagal: ' + e.message) }
        setTimeout(() => setMsg(''), 5000)
    }

    return (
        <div className="page">
            <div className="page-header">
                <div className="page-title">Settings</div>
                <div className="page-sub">Konfigurasi server, Telegram, dan admin token</div>
            </div>

            {msg && (
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
                    {msg}
                </div>
            )}

            {/* Admin Token */}
            <div className="card mb-16">
                <div className="card-title">🔑 Admin Token</div>
                <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
                    Token ini diperlukan untuk mengelola server. Disimpan di localStorage browser.
                </p>
                <div className="flex gap-8">
                    <input type="password" className="form-input" style={{ flex:1 }}
                        placeholder="Admin token (dari .env ADMIN_TOKEN)"
                        value={adminToken}
                        onChange={e => setAdminToken(e.target.value)}
                    />
                    <button className="btn btn-primary btn-sm" onClick={saveToken}>Simpan</button>
                </div>
            </div>

            {/* Telegram */}
            <div className="card mb-16">
                <div className="card-title">📨 Konfigurasi Telegram</div>
                <form onSubmit={handleSaveTg}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Bot Token (isi untuk update)</label>
                            <input type="password" className="form-input" placeholder="Kosongkan jika tidak ingin ganti"
                                value={botTokenInput}
                                onChange={e => setBotTokenInput(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Chat ID</label>
                            <input type="text" className="form-input" placeholder="123456789"
                                value={tg.chat_id || ''}
                                onChange={e => setTg(t => ({ ...t, chat_id: e.target.value }))} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                            <input type="checkbox" checked={!!tg.enabled}
                                onChange={e => setTg(t => ({ ...t, enabled: e.target.checked }))} />
                            <span>Aktifkan notifikasi Telegram</span>
                        </label>
                    </div>
                    <div className="flex gap-8">
                        <button type="submit" className="btn btn-primary btn-sm">💾 Simpan</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={handleTestTg}>📤 Test Kirim</button>
                    </div>
                </form>
            </div>

            {/* Add Server */}
            <div className="card mb-16">
                <div className="card-title">➕ Tambah Server</div>
                <form onSubmit={handleAddServer}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Nama *</label>
                            <input type="text" className="form-input" placeholder="Server-01"
                                value={newServer.name}
                                onChange={e => setNewServer(s => ({ ...s, name: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Hostname / IP</label>
                            <input type="text" className="form-input" placeholder="192.168.1.1"
                                value={newServer.hostname}
                                onChange={e => setNewServer(s => ({ ...s, hostname: e.target.value }))} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Tipe</label>
                            <select className="form-input" value={newServer.type}
                                onChange={e => setNewServer(s => ({ ...s, type: e.target.value }))}>
                                <option value="linux">Linux (Agent)</option>
                                <option value="mikrotik">Mikrotik (Poll)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Deskripsi</label>
                            <input type="text" className="form-input" placeholder="Opsional"
                                value={newServer.description}
                                onChange={e => setNewServer(s => ({ ...s, description: e.target.value }))} />
                        </div>
                    </div>
                    {newServer.type === 'mikrotik' && (
                        <div>
                            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--text2)' }}>
                                ℹ️ Pastikan REST API aktif di RouterOS: <b>IP → Services → www</b> (port 80).
                                Akun yang dipakai harus punya hak akses <b>read</b> minimal.
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Mikrotik Host / IP *</label>
                                    <input type="text" className="form-input" placeholder="192.168.88.1"
                                        value={newServer.mikrotik_host}
                                        onChange={e => setNewServer(s => ({ ...s, mikrotik_host: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Port REST API (default: 80)</label>
                                    <input type="number" className="form-input" placeholder="80"
                                        value={newServer.mikrotik_port}
                                        onChange={e => setNewServer(s => ({ ...s, mikrotik_port: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Username *</label>
                                    <input type="text" className="form-input" placeholder="admin"
                                        value={newServer.mikrotik_user}
                                        onChange={e => setNewServer(s => ({ ...s, mikrotik_user: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Password</label>
                                    <input type="password" className="form-input" value={newServer.mikrotik_pass}
                                        onChange={e => setNewServer(s => ({ ...s, mikrotik_pass: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                    )}
                    <button type="submit" className="btn btn-primary btn-sm">Tambah Server</button>
                </form>
            </div>

            {/* Server list */}
            <div className="card">
                <div className="card-title">🖥️ Daftar Server ({servers.length})</div>
                {servers.length === 0 ? (
                    <div className="text-muted text-sm">Belum ada server.</div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr><th>Nama</th><th>Hostname</th><th>Tipe</th><th>API Key / Info</th><th>Last Seen</th><th></th></tr>
                            </thead>
                            <tbody>
                                {servers.map(s => (
                                    <tr key={s.id}>
                                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                                        <td className="text-muted text-sm">{s.hostname || '-'}</td>
                                        <td><span className="badge blue">{s.type}</span></td>
                                        <td>
                                            {s.type === 'linux' ? (
                                                <code style={{ fontSize: 11, background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4 }}>
                                                    {s.api_key}
                                                </code>
                                            ) : (
                                                <span className="text-muted text-sm">polling otomatis</span>
                                            )}
                                        </td>
                                        <td className="text-sm text-muted">
                                            {s.last_seen ? new Date(s.last_seen).toLocaleString('id-ID') : 'Belum pernah'}
                                        </td>
                                        <td>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id, s.name)}>Hapus</button>
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
