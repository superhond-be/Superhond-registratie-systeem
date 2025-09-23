-- Superhond V1.2 – NL/BE klanten & honden schema
CREATE TABLE landen (
  code CHAR(2) PRIMARY KEY,
  naam  VARCHAR(64) NOT NULL
);

CREATE TABLE klanten (
  id           SERIAL PRIMARY KEY,
  voornaam     VARCHAR(80) NOT NULL,
  achternaam   VARCHAR(120) NOT NULL,
  email        VARCHAR(190) NOT NULL,
  tel_e164     VARCHAR(20),
  tel2_e164    VARCHAR(20),

  land_code    CHAR(2) NOT NULL REFERENCES landen(code),
  straat       VARCHAR(120) NOT NULL,
  huisnummer   VARCHAR(20)  NOT NULL,
  toevoeging   VARCHAR(10),
  postcode     VARCHAR(10) NOT NULL,
  plaats       VARCHAR(120) NOT NULL,

  opmerkingen  TEXT,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE honden (
  id           SERIAL PRIMARY KEY,
  klant_id     INT NOT NULL REFERENCES klanten(id) ON DELETE CASCADE,
  naam         VARCHAR(80) NOT NULL,
  ras          VARCHAR(120),
  geboortedatum DATE,
  opmerkingen  TEXT
);

INSERT INTO landen (code, naam) VALUES ('BE','België'), ('NL','Nederland');
