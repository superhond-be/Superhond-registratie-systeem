#!/bin/bash
# 🚀 Superhond lokale testserver – poort 5173 (macOS)
# Gebruik: ./start-5173.sh

echo "==========================================="
echo "🐾 Superhond testserver wordt gestart (poort 5173)"
echo "==========================================="

cd "$(dirname "$0")"

# Controleer of 'serve' aanwezig is
if ! command -v serve &> /dev/null
then
  echo "ℹ️  'serve' is niet geïnstalleerd. Start via npx..."
  npx serve public -l 5173 &
else
  serve public -l 5173 &
fi

sleep 2
open "http://localhost:5173/klantagenda/"

echo "✅ Server gestart op http://localhost:5173/"
echo "Druk Ctrl+C om te stoppen."
