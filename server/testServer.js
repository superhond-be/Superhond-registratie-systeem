// server/testServer.js
import express from "express";

const app = express();

// Wanneer je naar http://localhost:3000 gaat
app.get("/", (req, res) => {
  res.send("✅ Het werkt! Je draait nu lokaal.");
});

// Server starten
app.listen(3000, () => {
  console.log("🚀 Testserver gestart op http://localhost:3000");
});
