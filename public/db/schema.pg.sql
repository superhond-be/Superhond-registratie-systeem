CREATE TABLE IF NOT EXISTS klanten (
  id SERIAL PRIMARY KEY,
  naam TEXT NOT NULL,
  email TEXT,
  telefoon TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS honden (
  id SERIAL PRIMARY KEY,
  klant_id INTEGER NOT NULL REFERENCES klanten(id) ON DELETE CASCADE,
  naam TEXT NOT NULL,
  ras TEXT,
  geboortedatum DATE,
  notities TEXT,
  chipnummer TEXT UNIQUE,
  stamboeknummer TEXT,
  registratie_nummer TEXT,
  dierenarts_naam TEXT,
  dierenarts_praktijk TEXT,
  dierenarts_telefoon TEXT,
  dierenarts_email TEXT,
  medische_notities TEXT,
  credits INTEGER DEFAULT 0,
  geldig_tot DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
