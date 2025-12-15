#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# FormaNova API Server - Background Startup Script
# ═══════════════════════════════════════════════════════════════════════════
# This script starts the API server in the background and keeps it running
# even after you disconnect from SSH or close your laptop.
#
# Usage:
#   ./start_server.sh         # Start server in background
#   ./start_server.sh stop    # Stop the server
#   ./start_server.sh status  # Check if server is running
#   ./start_server.sh logs    # View live logs
#   ./start_server.sh restart # Restart the server
# ═══════════════════════════════════════════════════════════════════════════

SERVER_DIR="/home/bilal/uswa/viton_jewelry_model"
VENV_PYTHON="/home/bilal/viton_jewelry_model/.venv/bin/python"
PID_FILE="$SERVER_DIR/.api_server.pid"
LOG_FILE="$SERVER_DIR/api_server.log"
SCRIPT_NAME="api_server.py"

cd "$SERVER_DIR" || exit 1

start_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "⚠️  Server already running (PID: $PID)"
            echo "   Use './start_server.sh stop' to stop it first"
            exit 1
        else
            rm -f "$PID_FILE"
        fi
    fi

    echo "🚀 Starting FormaNova API Server..."
    echo "   Log file: $LOG_FILE"
    
    # Start server with nohup (survives SSH disconnect)
    nohup "$VENV_PYTHON" "$SCRIPT_NAME" >> "$LOG_FILE" 2>&1 &
    PID=$!
    echo $PID > "$PID_FILE"
    
    # Wait a moment and check if it started
    sleep 3
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ Server started successfully (PID: $PID)"
        echo "   Access: http://48.214.48.103:8000"
        echo ""
        echo "   Commands:"
        echo "   ./start_server.sh logs    - View live logs"
        echo "   ./start_server.sh status  - Check status"
        echo "   ./start_server.sh stop    - Stop server"
    else
        echo "❌ Server failed to start. Check logs:"
        tail -20 "$LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
    fi
}

stop_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "🛑 Stopping server (PID: $PID)..."
            kill "$PID"
            sleep 2
            if ps -p "$PID" > /dev/null 2>&1; then
                echo "   Force killing..."
                kill -9 "$PID"
            fi
            rm -f "$PID_FILE"
            echo "✅ Server stopped"
        else
            echo "⚠️  Server not running (stale PID file)"
            rm -f "$PID_FILE"
        fi
    else
        echo "⚠️  No PID file found. Server may not be running."
        # Try to find and kill any running instance
        PIDS=$(pgrep -f "python.*api_server.py")
        if [ -n "$PIDS" ]; then
            echo "   Found running processes: $PIDS"
            echo "   Killing them..."
            kill $PIDS 2>/dev/null
            echo "✅ Done"
        fi
    fi
}

status_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "✅ Server is RUNNING (PID: $PID)"
            echo ""
            # Test health endpoint
            echo "Testing health endpoint..."
            curl -s http://127.0.0.1:8000/health | python3 -m json.tool 2>/dev/null || echo "   (health check failed)"
        else
            echo "❌ Server is NOT running (stale PID file)"
            rm -f "$PID_FILE"
        fi
    else
        # Check if running without PID file
        PIDS=$(pgrep -f "python.*api_server.py")
        if [ -n "$PIDS" ]; then
            echo "⚠️  Server running without PID file (PIDs: $PIDS)"
        else
            echo "❌ Server is NOT running"
        fi
    fi
}

view_logs() {
    if [ -f "$LOG_FILE" ]; then
        echo "📋 Live logs (Ctrl+C to exit):"
        echo "═══════════════════════════════════════════════════════════════"
        tail -f "$LOG_FILE"
    else
        echo "⚠️  No log file found at $LOG_FILE"
    fi
}

# Main command handler
case "${1:-start}" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        stop_server
        sleep 2
        start_server
        ;;
    status)
        status_server
        ;;
    logs)
        view_logs
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
