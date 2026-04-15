#!/bin/bash
# ============================================================
#  NMS-PBG Agent Installer
#
#  1-command install:
#  curl -sSL https://raw.githubusercontent.com/fikrisuhana/nms-pbg/main/agent/install.sh \
#    | sudo bash -s -- https://monit.domain.com YOUR_API_KEY
#
#  Manual: sudo bash install.sh [NMS_URL] [API_KEY] [interface] [interval]
# ============================================================

set -e

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: Jalankan sebagai root (sudo bash install.sh ...)"
    exit 1
fi

# ── Ambil args atau prompt ────────────────────────────────────
NMS_SERVER="${1:-}"
API_KEY="${2:-}"
INTERFACE="${3:-}"
INTERVAL="${4:-30}"
DISK_PATH="${5:-/}"

if [ -z "$NMS_SERVER" ]; then
    read -rp "NMS Server URL (contoh: https://monit.domain.com): " NMS_SERVER
fi
if [ -z "$API_KEY" ]; then
    read -rp "API Key (dari halaman Settings): " API_KEY
fi
if [ -z "$INTERFACE" ]; then
    INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)
fi

if [ -z "$NMS_SERVER" ] || [ -z "$API_KEY" ]; then
    echo "ERROR: NMS_SERVER dan API_KEY wajib diisi."
    exit 1
fi

echo "========================================"
echo "  NMS-PBG Agent Installer"
echo "========================================"
echo "  Server : $NMS_SERVER"
echo "  Interface: $INTERFACE"
echo "  Interval : ${INTERVAL}s"
echo "========================================"

# ── Download agent terbaru ────────────────────────────────────
INSTALL_DIR="/opt/nms-agent"
mkdir -p "$INSTALL_DIR"

AGENT_URL="https://raw.githubusercontent.com/fikrisuhana/nms-pbg/main/agent/agent.sh"

if curl -sSL "$AGENT_URL" -o "$INSTALL_DIR/agent.sh" 2>/dev/null; then
    echo "Agent diunduh dari GitHub."
elif [ -f "$(dirname "$0")/agent.sh" ]; then
    cp "$(dirname "$0")/agent.sh" "$INSTALL_DIR/agent.sh"
    echo "Agent disalin dari lokal."
else
    echo "ERROR: Tidak bisa mendapatkan agent.sh"
    exit 1
fi

chmod +x "$INSTALL_DIR/agent.sh"

# ── Tulis config ──────────────────────────────────────────────
cat > /etc/nms-agent.env <<EOF
NMS_SERVER=${NMS_SERVER}
API_KEY=${API_KEY}
INTERFACE=${INTERFACE}
INTERVAL=${INTERVAL}
DISK_PATH=${DISK_PATH}
EOF
chmod 600 /etc/nms-agent.env

# ── Systemd service ───────────────────────────────────────────
cat > /etc/systemd/system/nms-agent.service <<EOF
[Unit]
Description=NMS-PBG Monitoring Agent
After=network-online.target
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
systemctl enable nms-agent --quiet
systemctl restart nms-agent

sleep 2
STATUS=$(systemctl is-active nms-agent)

echo ""
echo "========================================"
echo "  ✅ Agent berhasil diinstall!"
echo "  Status: $STATUS"
echo ""
echo "  Log: journalctl -u nms-agent -f"
echo "========================================"
