#!/usr/bin/env bash
# ============================================================
# Composer MCP — one-shot VPS setup
# Run as root on Ubuntu 20.04 / 22.04
# Usage: bash setup.sh
# ============================================================
set -e

INSTALL_DIR="/opt/composer-mcp"
SERVICE_NAME="composer-mcp"
PORT=3000

# ── colours ──────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
fail() { echo -e "${RED}✗ $*${NC}"; exit 1; }
step() { echo -e "\n${YELLOW}▶ $*${NC}"; }

# ── 1. Node.js ────────────────────────────────────────────────
step "Checking Node.js..."
if ! command -v node &>/dev/null; then
  warn "Node.js not found — installing Node.js 22 via NodeSource..."
  apt-get update -q
  apt-get install -y -q curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
  ok "Node.js $(node -v) installed"
else
  NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
  if [ "$NODE_MAJOR" -lt 18 ]; then
    warn "Node.js $(node -v) is too old (need 18+) — upgrading to Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -q nodejs
    ok "Node.js $(node -v) installed"
  else
    ok "Node.js $(node -v) — good"
  fi
fi

# ── 2. Find the tarball ───────────────────────────────────────
step "Looking for composer-mcp.tar.gz..."
TARBALL=""
for candidate in \
    "$HOME/composer-mcp.tar.gz" \
    "/root/composer-mcp.tar.gz" \
    "$(pwd)/composer-mcp.tar.gz"; do
  if [ -f "$candidate" ]; then
    TARBALL="$candidate"
    break
  fi
done

if [ -z "$TARBALL" ]; then
  # ask
  echo ""
  read -rp "  Enter the full path to composer-mcp.tar.gz: " TARBALL
  [ -f "$TARBALL" ] || fail "File not found: $TARBALL"
fi
ok "Found tarball at $TARBALL"

# ── 3. Extract ────────────────────────────────────────────────
step "Extracting to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
tar -xzf "$TARBALL" -C "$INSTALL_DIR"
[ -f "$INSTALL_DIR/dist/index.mjs" ] || fail "dist/index.mjs not found after extraction"
ok "Extracted — $(du -sh "$INSTALL_DIR/dist/index.mjs" | cut -f1) main bundle"

# ── 4. .env file ──────────────────────────────────────────────
step "Setting up environment..."
ENV_FILE="$INSTALL_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo ""
  echo "  Enter a bearer token for the MCP API."
  echo "  Claude Desktop will send this token when connecting."
  echo "  Press Enter to use a random token."
  read -rp "  Token (leave blank for random): " USER_TOKEN
  if [ -z "$USER_TOKEN" ]; then
    USER_TOKEN=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
    echo ""
    warn "Generated token: $USER_TOKEN"
    warn "Save this — you'll need it in Claude Desktop."
  fi

  cat > "$ENV_FILE" <<EOF
PORT=$PORT
COMPOSER_MOCK=1
COMPOSER_API_KEY=$USER_TOKEN
COMPOSER_MCP_ORG_ID=mcp-customer
EOF
  ok ".env written"
else
  ok ".env already exists — skipping"
fi

# ── 5. Quick smoke test ───────────────────────────────────────
step "Smoke test (starting briefly)..."
cd "$INSTALL_DIR"
# load env and run for 3 seconds, capture output
timeout 5 bash -c "set -a; source .env; set +a; node dist/index.mjs" 2>&1 | grep -i "listen" \
  && ok "Server starts cleanly" \
  || warn "Could not confirm startup — check manually after install"

# ── 6. systemd service ────────────────────────────────────────
step "Installing systemd service..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Composer MCP Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$(which node) $INSTALL_DIR/dist/index.mjs
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
sleep 2

if systemctl is-active --quiet "$SERVICE_NAME"; then
  ok "Service running"
else
  warn "Service may not have started — check: journalctl -u $SERVICE_NAME -n 30"
fi

# ── 7. Verify endpoint ────────────────────────────────────────
step "Verifying /api/mcp..."
sleep 1
RESP=$(curl -s --max-time 5 "http://localhost:$PORT/api/mcp" 2>/dev/null || true)
if echo "$RESP" | grep -q '"composer-studio"'; then
  ok "GET http://localhost:$PORT/api/mcp → responding"
else
  warn "No response yet — the service may still be starting up"
  warn "  Try: curl http://localhost:$PORT/api/mcp"
fi

# ── 8. Nginx hint ─────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
ok "Setup complete!"
echo ""
echo "  Internal URL:   http://localhost:$PORT/api/mcp"
TOKEN_VAL=$(grep COMPOSER_API_KEY "$ENV_FILE" | cut -d= -f2)
echo "  Bearer token:   $TOKEN_VAL"
echo ""
echo "  To check logs:  journalctl -u $SERVICE_NAME -f"
echo "  To restart:     systemctl restart $SERVICE_NAME"
echo ""
echo "  ── If you have a domain + nginx ───────────────────────"
echo ""
echo "  Add this block inside your server {} in nginx.conf:"
echo ""
echo "    location /api/mcp {"
echo "        proxy_pass http://localhost:$PORT;"
echo "        proxy_http_version 1.1;"
echo "        proxy_set_header Connection '';"
echo "        proxy_buffering off;"
echo "        proxy_cache off;"
echo "        proxy_read_timeout 300s;"
echo "    }"
echo ""
echo "  Then: nginx -t && systemctl reload nginx"
echo ""
echo "  ── Claude Desktop config ──────────────────────────────"
echo ""
echo '  ~/Library/Application Support/Claude/claude_desktop_config.json'
echo ""
echo '  {'
echo '    "mcpServers": {'
echo '      "composer-studio": {'
echo '        "type": "http",'
echo "        \"url\": \"https://YOURDOMAIN.COM/api/mcp\","
echo '        "headers": {'
echo "          \"Authorization\": \"Bearer $TOKEN_VAL\""
echo '        }'
echo '      }'
echo '    }'
echo '  }'
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
