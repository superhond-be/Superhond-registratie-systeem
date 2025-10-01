// server/routes/agenda.js
import express from "express";
const router = express.Router();

// Voorbeeld: later kan je dit uit Postgres halen
const agenda = [
  { id: 1, datum: "2025-10-01", titel: "Puppy training", locatie: "Gent" },
  { id: 2, datum: "2025-10-03", titel: "Grooming workshop", locatie: "Antwerpen" }
];

// GET /api/agenda
router.get("/", (req, res) => {
  res.json({ agenda });
});

export default router;
