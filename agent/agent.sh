#!/bin/bash
# ============================================================
#  NMS-PBG Agent — kirim metrics ke central monitoring server
#  Config: /etc/nms-agent.env
# ============================================================

CONFIG_FILE="/etc/nms-agent.env"

if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

NMS_SERVER="${NMS_SERVER:-http://localhost:3000}"
API_KEY="${API_KEY:-}"
INTERVAL="${INTERVAL:-30}"
INTERFACE="${INTERFACE:-$(ip route | grep default | awk '{print $5}' | head -1)}"
DISK_PATH="${DISK_PATH:-/}"

# Ekstrak hostname dari URL untuk ping
NMS_HOST=$(echo "$NMS_SERVER" | sed 's|https\?://||' | cut -d/ -f1 | cut -d: -f1)

if [ -z "$API_KEY" ]; then
    echo "[NMS] ERROR: API_KEY tidak di-set. Edit $CONFIG_FILE"
    exit 1
fi

# ── CPU Usage (sample 1 detik) ────────────────────────────────
get_cpu() {
    read -r _ user1 nice1 sys1 idle1 iowait1 irq1 soft1 steal1 _ <<< $(grep '^cpu ' /proc/stat)
    local total1=$((user1+nice1+sys1+idle1+iowait1+irq1+soft1+steal1))

    sleep 1

    read -r _ user2 nice2 sys2 idle2 iowait2 irq2 soft2 steal2 _ <<< $(grep '^cpu ' /proc/stat)
    local total2=$((user2+nice2+sys2+idle2+iowait2+irq2+soft2+steal2))

    local dt=$((total2 - total1))
    local di=$((idle2 - idle1))
    [ "$dt" -eq 0 ] && echo "0" && return
    awk "BEGIN {printf \"%.2f\", ($dt - $di) * 100 / $dt}"
}

# ── RAM (bytes) ───────────────────────────────────────────────
get_ram() {
    local total avail
    total=$(grep '^MemTotal:' /proc/meminfo | awk '{print $2}')
    avail=$(grep '^MemAvailable:' /proc/meminfo | awk '{print $2}')
    echo "$((total * 1024)):$((avail * 1024))"
}

# ── Disk (bytes) ──────────────────────────────────────────────
get_disk() {
    local info
    info=$(df -B1 "$DISK_PATH" 2>/dev/null | awk 'NR==2 {print $3":"$2}')
    echo "${info:-0:0}"
}

# ── Network cumulative bytes ──────────────────────────────────
get_net() {
    local iface="${INTERFACE:-eth0}"
    local line
    line=$(grep -E "^\s*${iface}:" /proc/net/dev 2>/dev/null | awk '{print $2":"$10}')
    echo "${line:-0:0}"
}

# ── Load average ─────────────────────────────────────────────
get_load() {
    awk '{print $1":"$2":"$3}' /proc/loadavg
}

# ── Uptime (seconds) ──────────────────────────────────────────
get_uptime() {
    awk '{printf "%d", $1}' /proc/uptime
}

# ── Process count ─────────────────────────────────────────────
get_procs() {
    ls /proc | grep -c '^[0-9]*$' 2>/dev/null || echo 0
}

# ── Ping ke NMS server (ms) ───────────────────────────────────
get_ping() {
    local ms
    ms=$(ping -c 2 -W 2 "$NMS_HOST" 2>/dev/null \
         | awk -F'/' 'END { if ($5) printf "%.2f", $5; else print "0" }')
    echo "${ms:-0}"
}

# ── SSH / active login sessions ───────────────────────────────
get_sessions() {
    who 2>/dev/null | grep -v '^$' | wc -l || echo 0
}

# ── Send to server ────────────────────────────────────────────
send_metrics() {
    local cpu ram_info disk_info net_info load_info
    local ram_total_raw ram_avail_raw ram_used_bytes ram_total_bytes
    local disk_used disk_total
    local net_rx net_tx
    local load1 load5 load15
    local uptime procs ping_ms sessions

    cpu=$(get_cpu)

    ram_info=$(get_ram)
    ram_total_raw=$(echo "$ram_info" | cut -d: -f1)
    ram_avail_raw=$(echo "$ram_info" | cut -d: -f2)
    ram_used_bytes=$((ram_total_raw - ram_avail_raw))
    ram_total_bytes=$ram_total_raw

    disk_info=$(get_disk)
    disk_used=$(echo "$disk_info" | cut -d: -f1)
    disk_total=$(echo "$disk_info" | cut -d: -f2)

    net_info=$(get_net)
    net_rx=$(echo "$net_info" | cut -d: -f1)
    net_tx=$(echo "$net_info" | cut -d: -f2)

    load_info=$(get_load)
    load1=$(echo "$load_info"  | cut -d: -f1)
    load5=$(echo "$load_info"  | cut -d: -f2)
    load15=$(echo "$load_info" | cut -d: -f3)

    uptime=$(get_uptime)
    procs=$(get_procs)
    ping_ms=$(get_ping)
    sessions=$(get_sessions)

    local payload
    payload=$(cat <<EOF
{
  "cpu_usage":       ${cpu:-0},
  "ram_used":        ${ram_used_bytes:-0},
  "ram_total":       ${ram_total_bytes:-0},
  "disk_used":       ${disk_used:-0},
  "disk_total":      ${disk_total:-0},
  "net_rx_bytes":    ${net_rx:-0},
  "net_tx_bytes":    ${net_tx:-0},
  "load_1":          ${load1:-0},
  "load_5":          ${load5:-0},
  "load_15":         ${load15:-0},
  "uptime_seconds":  ${uptime:-0},
  "process_count":   ${procs:-0},
  "ping_ms":         ${ping_ms:-0},
  "active_sessions": ${sessions:-0}
}
EOF
)

    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${NMS_SERVER}/api/metrics" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: ${API_KEY}" \
        -d "$payload" \
        --connect-timeout 10 \
        --max-time 20 \
        2>/dev/null)

    if [ "$http_code" != "200" ]; then
        echo "[NMS] $(date '+%H:%M:%S') Send failed (HTTP $http_code)"
    fi
}

# ── Main ──────────────────────────────────────────────────────
echo "[NMS] Agent started — server: $NMS_SERVER | interface: $INTERFACE | interval: ${INTERVAL}s"

while true; do
    send_metrics
    # CPU measurement already sleeps 1s, subtract from interval
    sleep $((INTERVAL > 2 ? INTERVAL - 1 : 1))
done
