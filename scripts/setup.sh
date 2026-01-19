#!/bin/bash

# =============================================================================
# FormaNova Frontend - Complete Setup Script
# =============================================================================
# Run this ONCE after cloning the repo:
#   chmod +x scripts/setup.sh && ./scripts/setup.sh
#
# This script will:
#   1. Install Node.js 18+ if missing
#   2. Install npm dependencies
#   3. Build the production bundle
#   4. Create systemd service for auto-start on boot
#   5. Start the service
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get absolute path to project
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="formanova"
LOG_DIR="$PROJECT_DIR/logs"
PORT=4173

echo ""
echo -e "${BLUE}=============================================="
echo "  FormaNova Frontend - Complete Setup"
echo -e "==============================================${NC}"
echo ""
echo "Project directory: $PROJECT_DIR"
echo ""

# -----------------------------------------------------------------------------
# Step 1: Check/Install Node.js
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/8] Checking Node.js...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Installing...${NC}"
    
    # Try NodeSource first (works on most systems)
    if command -v apt &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt install -y nodejs
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    else
        # Fallback to nvm
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        nvm install 18
        nvm use 18
    fi
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js $NODE_VERSION${NC}"

# -----------------------------------------------------------------------------
# Step 2: Install npm dependencies
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[2/8] Installing npm dependencies...${NC}"

cd "$PROJECT_DIR"
npm install

echo -e "${GREEN}✓ Dependencies installed${NC}"

# -----------------------------------------------------------------------------
# Step 3: Install serve globally for production
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[3/8] Installing serve for production...${NC}"

npm install -g serve

echo -e "${GREEN}✓ Serve installed${NC}"

# -----------------------------------------------------------------------------
# Step 4: Create .env file
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[4/8] Creating environment file...${NC}"

if [ -f "$PROJECT_DIR/.env" ]; then
    echo -e "${GREEN}✓ .env file already exists${NC}"
else
    cat > "$PROJECT_DIR/.env" << 'EOF'
# FormaNova Frontend Environment Variables
# These connect to Lovable Cloud (Supabase)

VITE_SUPABASE_URL=https://volhgtspbvgxavqgueqc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvbGhndHNwYnZneGF2cWd1ZXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NjE5NDAsImV4cCI6MjA4MTMzNzk0MH0.Hc87OH2ipq4XgNXesDB7plggk2hk-azhaIgOpVJyaaY
VITE_SUPABASE_PROJECT_ID=volhgtspbvgxavqgueqc
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
fi

# -----------------------------------------------------------------------------
# Step 5: Build the project
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[5/8] Building production bundle...${NC}"

npm run build

echo -e "${GREEN}✓ Build complete (files in dist/)${NC}"

# -----------------------------------------------------------------------------
# Step 6: Create logs directory
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[6/8] Creating logs directory...${NC}"

mkdir -p "$LOG_DIR"
echo -e "${GREEN}✓ Logs directory: $LOG_DIR${NC}"

# -----------------------------------------------------------------------------
# Step 7: Create systemd service
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[7/8] Creating systemd service...${NC}"

# Get the path to node and serve
NODE_PATH=$(which node)
SERVE_PATH=$(which serve)

# Create systemd service file
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=FormaNova Frontend Server
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$SERVE_PATH -s dist -l tcp://0.0.0.0:$PORT
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/formanova.log
StandardError=append:$LOG_DIR/formanova-error.log
Environment=NODE_ENV=production
Environment=PATH=/usr/local/bin:/usr/bin:/bin:$HOME/.nvm/versions/node/v18/bin

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}.service

echo -e "${GREEN}✓ Systemd service created and enabled${NC}"

# -----------------------------------------------------------------------------
# Step 8: Start the service
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[8/8] Starting FormaNova service...${NC}"

sudo systemctl start ${SERVICE_NAME}.service

# Wait a moment for startup
sleep 2

# Check status
if sudo systemctl is-active --quiet ${SERVICE_NAME}.service; then
    echo -e "${GREEN}✓ Service is running${NC}"
else
    echo -e "${RED}✗ Service failed to start. Check logs:${NC}"
    echo "  sudo journalctl -u ${SERVICE_NAME}.service -n 50"
fi

# -----------------------------------------------------------------------------
# Done!
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}=============================================="
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${BLUE}==============================================${NC}"
echo ""
echo -e "Frontend URL:      ${GREEN}http://0.0.0.0:$PORT${NC}"
echo -e "                   ${GREEN}http://$(hostname -I | awk '{print $1}'):$PORT${NC}"
echo ""
echo -e "Logs:              ${YELLOW}$LOG_DIR/formanova.log${NC}"
echo -e "Error logs:        ${YELLOW}$LOG_DIR/formanova-error.log${NC}"
echo ""
echo -e "Commands:"
echo -e "  Start:           ${BLUE}./scripts/start.sh${NC}"
echo -e "  Stop:            ${BLUE}./scripts/stop.sh${NC}"
echo -e "  View logs:       ${BLUE}tail -f $LOG_DIR/formanova.log${NC}"
echo -e "  Service status:  ${BLUE}sudo systemctl status ${SERVICE_NAME}${NC}"
echo ""
echo -e "${GREEN}The service will auto-start on system boot!${NC}"
echo ""
