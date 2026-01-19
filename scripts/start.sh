#!/bin/bash

# =============================================================================
# FormaNova Frontend - Startup Script
# =============================================================================
# Run this to start/stop/restart the frontend server:
#   ./scripts/start.sh [start|stop|restart|status|dev|logs]
# =============================================================================

set -e

APP_NAME="formanova-frontend"
PORT=3000

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

show_status() {
    echo ""
    echo -e "${CYAN}=== FormaNova Frontend Status ===${NC}"
    pm2 describe $APP_NAME 2>/dev/null || echo -e "${YELLOW}Not running${NC}"
    echo ""
}

start_server() {
    echo -e "${YELLOW}Starting FormaNova Frontend...${NC}"
    
    # Check if dist folder exists
    if [ ! -d "dist" ]; then
        echo -e "${YELLOW}No build found. Building first...${NC}"
        npm run build
    fi
    
    # Stop existing if running
    pm2 delete $APP_NAME 2>/dev/null || true
    
    # Start with PM2
    pm2 serve dist $PORT --spa --name $APP_NAME
    
    # Save PM2 config for auto-restart on reboot
    pm2 save
    
    echo ""
    echo -e "${GREEN}✓ Frontend running at http://localhost:$PORT${NC}"
    echo ""
    echo "Useful commands:"
    echo "  ./scripts/start.sh logs    - View logs"
    echo "  ./scripts/start.sh stop    - Stop server"
    echo "  ./scripts/start.sh restart - Restart server"
    echo ""
}

stop_server() {
    echo -e "${YELLOW}Stopping FormaNova Frontend...${NC}"
    pm2 delete $APP_NAME 2>/dev/null || true
    echo -e "${GREEN}✓ Stopped${NC}"
}

restart_server() {
    echo -e "${YELLOW}Restarting FormaNova Frontend...${NC}"
    
    # Rebuild first
    npm run build
    
    # Restart PM2
    pm2 delete $APP_NAME 2>/dev/null || true
    pm2 serve dist $PORT --spa --name $APP_NAME
    pm2 save
    
    echo -e "${GREEN}✓ Restarted${NC}"
}

view_logs() {
    pm2 logs $APP_NAME
}

start_dev() {
    echo -e "${YELLOW}Starting in development mode...${NC}"
    echo -e "${CYAN}Press Ctrl+C to stop${NC}"
    echo ""
    npm run dev
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

case "${1:-start}" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        show_status
        ;;
    dev)
        start_dev
        ;;
    logs)
        view_logs
        ;;
    *)
        echo "Usage: ./scripts/start.sh [start|stop|restart|status|dev|logs]"
        echo ""
        echo "Commands:"
        echo "  start   - Start production server (default)"
        echo "  stop    - Stop production server"
        echo "  restart - Rebuild and restart"
        echo "  status  - Show server status"
        echo "  dev     - Start development server"
        echo "  logs    - View server logs"
        exit 1
        ;;
esac
