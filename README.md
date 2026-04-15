# nms-pbg

Network Monitoring System — monitoring server Linux & Mikrotik dengan alert Telegram otomatis.

## Arsitektur

```
[Server Linux]   ──── HTTPS (agent push) ────►  [NMS Server]
[Mikrotik]       ◄─── HTTP poll tiap 30s ─────   Backend API
                                                  PostgreSQL DB
                                                  React Dashboard
                                                       │
                                                  Telegram Alert
```

## Fitur

- **Agent-based** untuk server Linux — kirim CPU, RAM, Disk, Network, Load, Uptime tiap 30 detik
- **Poll-based** untuk Mikrotik — backend pull dari RouterOS REST API
- **Alert otomatis** ke Telegram saat CPU/RAM/Disk melewati threshold
- **Threshold per server** — bisa diatur lewat web dashboard (warning & critical %)
- **Cooldown alert** — tidak spam, ada jeda minimum per alert
- **Dashboard real-time** — grafik CPU/RAM/Disk/Network dengan pemilihan periode (1h/6h/24h/7d)
- **Dockerized** — satu `docker-compose up` langsung jalan

---

## Quick Start

### 1. Clone & konfigurasi

```bash
git clone https://github.com/fikrisuhana/nms-pbg.git
cd nms-pbg
cp .env.example .env
nano .env   # Ganti DB_PASS dan ADMIN_TOKEN
```

### 2. Jalankan

```bash
docker-compose up -d
```

- Dashboard: `http://server-ip:8080`
- API: `http://server-ip:3000`

### 3. Tambah server pertama

1. Buka dashboard → **Settings**
2. Isi **Admin Token** (dari `.env` `ADMIN_TOKEN`) → Simpan
3. Tambah server baru → catat **API Key** yang dihasilkan
4. Konfigurasi Telegram (bot token + chat ID)

---

## Install Agent di Server Linux

```bash
# Salin agent ke server target
scp agent/agent.sh agent/install.sh root@server-target:/tmp/

# Jalankan installer
ssh root@server-target "bash /tmp/install.sh"
# Masukkan: NMS Server URL, API Key, interface, interval
```

Manual (tanpa installer):

```bash
# Buat config
cat > /etc/nms-agent.env <<EOF
NMS_SERVER=https://nms.domain.com
API_KEY=uuid-dari-settings
INTERFACE=eth0
INTERVAL=30
DISK_PATH=/
EOF

# Salin agent
mkdir -p /opt/nms-agent
cp agent.sh /opt/nms-agent/
chmod +x /opt/nms-agent/agent.sh

# Install & start service
cp nms-agent.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now nms-agent
```

---

## Monitoring Mikrotik

1. Pastikan **REST API aktif** di Mikrotik: *IP → Services → api-ssl atau www (port 80/443)*
2. Di dashboard Settings → Tambah server → pilih tipe **Mikrotik**
3. Isi Host, Port, Username, Password
4. Backend otomatis poll tiap 30 detik

---

## Threshold Alert

Per server, bisa diatur dari halaman **Server Detail**:

| Metrik | Default Warning | Default Critical |
|--------|----------------|-----------------|
| CPU    | 80%            | 90%             |
| RAM    | 80%            | 90%             |
| Disk   | 80%            | 90%             |

Alert dikirim ke Telegram dengan cooldown (default 5 menit) agar tidak spam.

---

## Struktur Folder

```
nms-pbg/
├── backend/          — Node.js Express API
│   └── src/
│       ├── routes/   — metrics, servers, alerts, thresholds, telegram, dashboard
│       ├── services/ — threshold check, telegram send, mikrotik poll
│       └── db/       — PostgreSQL pool
├── frontend/         — React dashboard (Vite + Recharts)
│   └── src/
│       ├── pages/    — Dashboard, ServerDetail, Alerts, Settings
│       └── components/
├── db/               — SQL schema (init.sql)
├── agent/            — Bash agent + installer + systemd service
└── docker-compose.yml
```

---

## Environment Variables

| Variable       | Default         | Keterangan                        |
|---------------|-----------------|-----------------------------------|
| `DB_NAME`     | `nms`           | Nama database PostgreSQL          |
| `DB_USER`     | `nms`           | User database                     |
| `DB_PASS`     | `nms_secret`    | Password database (**ganti ini**) |
| `BACKEND_PORT`| `3000`          | Port backend API                  |
| `FRONTEND_PORT`| `8080`         | Port dashboard web                |
| `ADMIN_TOKEN` | `changeme`      | Token admin (**ganti ini**)       |
