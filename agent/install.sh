#!/bin/bash
# ============================================================
#  NMS-PBG Agent Installer
#  Usage: sudo bash install.sh
# ============================================================

set -e

echo "========================================"
echo "  NMS-PBG Agent Installer"
echo "========================================"

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: Jalankan sebagai root (sudo bash install.sh)"
    exit 1
fi

# ── Prompt config ─────────────────────────────────────────────
read -rp "NMS Server URL (contoh: https://nms.domain.com): " NMS_SERVER
read -rp "API Key (dari halaman Settings): " API_KEY
read -rp "Network interface (default: auto-detect): " INTERFACE
read -rp "Interval pengiriman detik (default: 30): " INTERVAL
read -rp "Disk path to monitor (default: /): " DISK_PATH

[ -z "$INTERFACE" ] && INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)
[ -z "$INTERVAL"  ] && INTERVAL=30
[ -z "$DISK_PATH" ] && DISK_PATH="/"

if [ -z "$NMS_SERVER" ] || [ -z "$API_KEY" ]; then
    echo "ERROR: NMS_SERVER dan API_KEY wajib diisi."
    exit 1
fi

# ── Install files ─────────────────────────────────────────────
INSTALL_DIR="/opt/nms-agent"
mkdir -p "$INSTALL_DIR"

cp "$(dirname "$0")/agent.sh" "$INSTALL_DIR/agent.sh"
chmod +x "$INSTALL_DIR/agent.sh"

# ── Write config ──────────────────────────────────────────────
cat > /etc/nms-agent.env <<EOF
NMS_SERVER=${NMS_SERVER}
API_KEY=${API_KEY}
INTERFACE=${INTERFACE}
INTERVAL=${INTERVAL}
DISK_PATH=${DISK_PATH}
EOF

chmod 600 /etc/nms-agent.env
echo "Config disimpan ke /etc/nms-agent.env"

# ── Systemd service ───────────────────────────────────────────
cat > /etc/systemd/system/nms-agent.service <<EOF
[Unit]
Description=NMS-PBG Monitoring Agent
After=network.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/bin/bash ${INSTALL_DIR}/agent.sh
Restart=always
RestartSec=10
EnvironmentFile=/etc/nms-agent.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nms-agent
systemctl restart nms-agent

echo ""
echo "========================================"
echo "  ✅ Agent berhasil diinstall!"
echo "  Status: $(systemctl is-active nms-agent)"
echo ""
echo "  Perintah berguna:"
echo "  systemctl status nms-agent"
echo "  journalctl -u nms-agent -f"
echo "  systemctl restart nms-agent"
echo "========================================"
