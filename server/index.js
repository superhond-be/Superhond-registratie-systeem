import express from "express";

const app = express();

// Testroute
app.get("/", (req, res) => {
  res.send("✅ Superhond draait op StackBlitz!");
});

// Belangrijk: altijd PORT uit environment gebruiken
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server gestart op poort ${PORT}`);
});
