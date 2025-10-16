#!/bin/bash
# 🚀 Superhond lokale testserver voor macOS
# Locatie: hoofdmap van het project

echo "==========================================="
echo "🐾 Superhond lokale testserver wordt gestart"
echo "==========================================="

# Ga naar de map van dit script
cd "$(dirname "$0")"

# Controleer of 'serve' beschikbaar is, anders installeer tijdelijk
if ! command -v serve &> /dev/null
then
  echo "ℹ️  'serve' is niet geïnstalleerd. Start via npx..."
  npx serve public &
else
  serve public &
fi

# Even wachten tot de server draait
sleep 2

# Open automatisch de klantagenda in de standaardbrowser
open "http://localhost:5000/klantagenda/"

echo "✅ Server gestart. Te bereiken op http://localhost:5000/"
echo "Druk Ctrl+C om te stoppen."
