#!/bin/bash

# =============================================================================
# FormaNova Frontend - One-Time Setup Script
# =============================================================================
# Run this ONCE after cloning the repo:
#   chmod +x scripts/setup.sh && ./scripts/setup.sh
# =============================================================================

set -e

echo "=============================================="
echo "  FormaNova Frontend Setup"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Step 1: Check Node.js
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/6] Checking Node.js...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Installing via nvm...${NC}"
    
    # Install nvm if not present
    if ! command -v nvm &> /dev/null; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
    
    nvm install 18
    nvm use 18
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js $NODE_VERSION${NC}"

# -----------------------------------------------------------------------------
# Step 2: Install dependencies
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[2/6] Installing npm dependencies...${NC}"

npm install

echo -e "${GREEN}✓ Dependencies installed${NC}"

# -----------------------------------------------------------------------------
# Step 3: Create .env file
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[3/6] Creating environment file...${NC}"

if [ -f ".env" ]; then
    echo -e "${GREEN}✓ .env file already exists${NC}"
else
    cat > .env << 'EOF'
# FormaNova Frontend Environment Variables
# These connect to Lovable Cloud (Supabase) - DO NOT CHANGE unless you know what you're doing

VITE_SUPABASE_URL=https://volhgtspbvgxavqgueqc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvbGhndHNwYnZneGF2cWd1ZXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NjE5NDAsImV4cCI6MjA4MTMzNzk0MH0.Hc87OH2ipq4XgNXesDB7plggk2hk-azhaIgOpVJyaaY
VITE_SUPABASE_PROJECT_ID=volhgtspbvgxavqgueqc
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
fi

# -----------------------------------------------------------------------------
# Step 4: Build the project
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[4/6] Building production bundle...${NC}"

npm run build

echo -e "${GREEN}✓ Build complete (files in dist/)${NC}"

# -----------------------------------------------------------------------------
# Step 5: Install PM2 for production serving
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[5/6] Setting up PM2 for production...${NC}"

if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

echo -e "${GREEN}✓ PM2 installed${NC}"

# -----------------------------------------------------------------------------
# Step 6: Create startup script
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[6/6] Making startup script executable...${NC}"

chmod +x scripts/start.sh

echo -e "${GREEN}✓ Startup script ready${NC}"

# -----------------------------------------------------------------------------
# Done!
# -----------------------------------------------------------------------------
echo ""
echo "=============================================="
echo -e "${GREEN}  Setup Complete!${NC}"
echo "=============================================="
echo ""
echo "To start the frontend:"
echo "  ./scripts/start.sh"
echo ""
echo "Or for development mode:"
echo "  npm run dev"
echo ""
echo "The frontend will connect to:"
echo "  • Edge Functions: Lovable Cloud (already deployed)"
echo "  • Temporal API:   http://20.173.91.22:8000"
echo "  • Direct API:     http://20.173.91.22:8001"
echo ""
