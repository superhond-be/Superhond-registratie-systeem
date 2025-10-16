#!/bin/bash
# 🛑 Superhond lokale testserver stoppen (macOS)
echo "==========================================="
echo "🛑  Superhond lokale testserver wordt gestopt"
echo "==========================================="

# Zoek en beëindig processen die op poort 5000 luisteren
PID=$(lsof -ti tcp:5000)
if [ -n "$PID" ]; then
  echo "Proces gevonden op poort 5000 (PID: $PID)"
  kill -9 $PID
  echo "✅ Server op poort 5000 gestopt."
else
  echo "ℹ️  Geen actieve server gevonden op poort 5000."
fi
