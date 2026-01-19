#!/bin/bash

# =============================================================================
# FormaNova Frontend - Restart Script (with Fallbacks)
# =============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ""
echo "Restarting FormaNova..."
echo ""

# Stop first
"$PROJECT_DIR/scripts/stop.sh"

echo ""

# Then start
"$PROJECT_DIR/scripts/start.sh"
