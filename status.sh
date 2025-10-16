#!/bin/bash
# 🧩 Statuscontrole voor de Superhond lokale testserver
echo "==========================================="
echo "🔍 Controleer status van Superhond-server (poort 5000)"
echo "==========================================="

PID=$(lsof -ti tcp:5000)

if [ -n "$PID" ]; then
  echo "✅ Server draait (PID: $PID)"
  echo "URL: http://localhost:5000/"
else
  echo "⚠️  Server draait niet."
  read -p "Wil je de server nu starten? (j/n): " antwoord
  if [[ "$antwoord" == "j" || "$antwoord" == "J" ]]; then
    ./start.sh
  else
    echo "ℹ️  Server blijft gestopt."
  fi
fi
