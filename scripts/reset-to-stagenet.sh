#!/bin/bash

# Script to reset project from MAINNET to STAGENET
# This will delete all existing wallets and database (test data)

set -e

echo "🔄 Resetting XMR Direct to STAGENET..."
echo ""

# Get the script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

# Check if server is running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Warning: Server appears to be running on port 3000"
    echo "Please stop the server first (Ctrl+C in the server terminal)"
    exit 1
fi

# Backup old data
BACKUP_DIR="backup_mainnet_$(date +%Y%m%d_%H%M%S)"
echo "📦 Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Backup database if it exists
if [ -f "xmrdirect.db" ]; then
    echo "📁 Backing up database..."
    mv xmrdirect.db "$BACKUP_DIR/"
    echo "   ✓ Database backed up"
fi

# Backup wallets if they exist
if [ -d "server/wallets" ]; then
    echo "📁 Backing up wallet files..."
    mv server/wallets "$BACKUP_DIR/"
    echo "   ✓ Wallet files backed up"
fi

# Create fresh wallets directory
echo "📁 Creating fresh wallets directory..."
mkdir -p server/wallets

echo ""
echo "✅ Reset complete!"
echo ""
echo "Backup saved to: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "1. Verify .env has MONERO_NETWORK=stagenet"
echo "2. Verify client/.env has VITE_MONERO_NETWORK=stagenet"
echo "3. Rebuild: npm run build"
echo "4. Start server: npm run dev"
echo ""
echo "All new wallets and sessions will be created for STAGENET."
