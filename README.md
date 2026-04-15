# nms-pbg

Network Monitoring System — monitoring server Linux & Mikrotik dengan alert Telegram otomatis.

## Arsitektur

```
[Server Linux]   ──── HTTPS (agent push tiap 30s) ────►  [NMS Server]
[Mikrotik]       ◄─── HTTP poll tiap 30s ──────────────   Backend API (Node.js)
                                                           PostgreSQL DB
                                                           React Dashboard
                                                                │
                                                           Telegram Alert
```

## Fitur

| Fitur | Keterangan |
|-------|-----------|
| Agent Linux | Bash script kirim CPU, RAM, Disk, Network, Load, Uptime, Ping, SSH session |
| Mikrotik Poll | Backend pull dari RouterOS REST API tiap 30 detik |
| Alert Telegram | Kirim notif saat CPU/RAM/Disk melewati threshold |
| Threshold per server | Atur warning & critical % + cooldown dari dashboard |
| Ping monitoring | Agent ukur latency ke NMS server, tampil di dashboard |
| SSH session | Tampilkan jumlah user aktif yang login via SSH |
| Dashboard real-time | Auto-refresh 15 detik, tanpa reload halaman |
| Grafik historis | CPU/RAM/Disk/Network chart — pilih 1h/6h/24h/7d |
| Dockerized | Satu `docker-compose up -d` langsung jalan |

---

## Quick Start

### 1. Clone & setup

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

- **Dashboard**: `http://server-ip:8080`
- **API**: `http://server-ip:3000`

### 3. Setup pertama kali

1. Buka dashboard → **Settings**
2. Isi **Admin Token** (dari `.env` `ADMIN_TOKEN`) → Simpan
3. Tambah server baru → catat **API Key** yang muncul
4. Isi Telegram bot token + chat ID → Test Kirim

---

## Install Agent di Server Linux

### 1 Command (paling simpel)

```bash
curl -sSL https://raw.githubusercontent.com/fikrisuhana/nms-pbg/main/agent/install.sh \
  | sudo bash -s -- https://monit.domain.com API_KEY_DISINI
```

### Dengan opsi lengkap

```bash
curl -sSL https://raw.githubusercontent.com/fikrisuhana/nms-pbg/main/agent/install.sh \
  | sudo bash -s -- https://monit.domain.com API_KEY interface interval disk_path
# contoh:
# | sudo bash -s -- https://monit.domain.com abc-123 ens3 30 /
```

### Update agent yang sudah terpasang

```bash
curl -sSL https://raw.githubusercontent.com/fikrisuhana/nms-pbg/main/agent/agent.sh \
  -o /opt/nms-agent/agent.sh && systemctl restart nms-agent
```

### Perintah berguna

```bash
systemctl status nms-agent       # cek status
journalctl -u nms-agent -f       # lihat log live
nano /etc/nms-agent.env          # edit config
systemctl restart nms-agent      # restart
```

---

## Monitoring Mikrotik

1. Aktifkan REST API di Mikrotik: **IP → Services → www** (port 80)
2. Dashboard → Settings → Tambah Server → pilih tipe **Mikrotik**
3. Isi Host, Port (default 80), Username, Password
4. Backend otomatis poll tiap 30 detik

---

## Threshold Alert Telegram

Diatur per server di halaman **Server Detail**:

| Metrik | Default Warning | Default Critical | Cooldown |
|--------|----------------|-----------------|---------|
| CPU    | 80%            | 90%             | 5 menit |
| RAM    | 80%            | 90%             | 5 menit |
| Disk   | 80%            | 90%             | 5 menit |

Alert tidak spam — ada cooldown per level. Setelah cooldown berlalu baru kirim lagi.

---

## Upgrade DB (jika sudah ada instalasi lama)

Jika upgrade dari versi sebelumnya, jalankan migrasi ini:

```bash
docker exec nms-pbg-db-1 psql -U nms -d nms -c "
  ALTER TABLE metrics ADD COLUMN IF NOT EXISTS ping_ms NUMERIC(8,2) DEFAULT 0;
  ALTER TABLE metrics ADD COLUMN IF NOT EXISTS active_sessions INT DEFAULT 0;
"
```

---

## Struktur Folder

```
nms-pbg/
├── backend/              — Node.js Express API
│   └── src/
│       ├── routes/       — metrics, servers, alerts, thresholds, telegram, dashboard
│       ├── services/     — threshold check, telegram send, mikrotik poll
│       └── db/           — PostgreSQL pool
├── frontend/             — React + Vite dashboard (dark theme)
│   └── src/
│       ├── pages/        — Dashboard, Servers, ServerDetail, Alerts, Settings
│       └── components/   — Layout, ServerCard, MetricChart
├── db/                   — SQL schema (init.sql)
├── agent/                — Bash agent + installer + systemd service
└── docker-compose.yml
```

---

## Environment Variables

| Variable        | Default       | Keterangan                        |
|----------------|---------------|-----------------------------------|
| `DB_NAME`      | `nms`         | Nama database PostgreSQL          |
| `DB_USER`      | `nms`         | User database                     |
| `DB_PASS`      | `nms_secret`  | Password database (**ganti ini**) |
| `BACKEND_PORT` | `3000`        | Port backend API                  |
| `FRONTEND_PORT`| `8080`        | Port dashboard web                |
| `ADMIN_TOKEN`  | `changeme`    | Token admin (**ganti ini**)       |

---

## Agent Config (`/etc/nms-agent.env`)

| Variable      | Default   | Keterangan                          |
|--------------|-----------|-------------------------------------|
| `NMS_SERVER` | —         | URL NMS server (wajib)              |
| `API_KEY`    | —         | API key dari dashboard (wajib)      |
| `INTERFACE`  | auto      | Network interface (eth0, ens3, dll) |
| `INTERVAL`   | `30`      | Interval kirim data (detik)         |
| `DISK_PATH`  | `/`       | Path disk yang dimonitor            |
