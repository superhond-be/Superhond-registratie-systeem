-- Maak tabellen
DROP TABLE IF EXISTS honden;
DROP TABLE IF EXISTS klanten;

CREATE TABLE klanten (
  id VARCHAR(10) PRIMARY KEY,
  voornaam     VARCHAR(50) NOT NULL,
  achternaam   VARCHAR(50) NOT NULL,
  email        VARCHAR(100),
  telefoon     VARCHAR(30),
  land         VARCHAR(2),
  plaats       VARCHAR(50)
);

CREATE TABLE honden (
  id VARCHAR(10) PRIMARY KEY,
  naam          VARCHAR(50) NOT NULL,
  ras           VARCHAR(50),
  geboortedatum DATE,
  eigenaarId    VARCHAR(10) REFERENCES klanten(id)
);

-- Vul klanten
INSERT INTO klanten (id, voornaam, achternaam, email, telefoon, land, plaats) VALUES
('K1001','An','Peeters','an.peeters@example.be','+32 475 11 22 33','BE','Retie'),
('K1002','Tom','Janssens','tom.janssens@example.be','+32 486 66 77 88','BE','Dessel'),
('K1003','Sofie','De Smet','sofie.desmet@example.be','+32 478 12 34 56','BE','Turnhout'),
('K1004','Jan','van Dijk','jan.vandijk@example.nl','+31 6 1234 5678','NL','Eindhoven'),
('K1005','Lisa','de Boer','lisa.deboer@example.nl','+31 6 8765 4321','NL','Tilburg'),
('K1006','Mark','Vermeer','mark.vermeer@example.nl','+31 6 1122 3344','NL','Breda');

-- Vul honden
INSERT INTO honden (id, naam, ras, geboortedatum, eigenaarId) VALUES
('H2001','Rex','Mechelse Herder','2020-05-12','K1001'),
('H2002','Max','Border Collie','2021-02-18','K1001'),
('H2003','Bella','Labrador Retriever','2019-11-03','K1002'),
('H2004','Luna','Golden Retriever','2022-06-20','K1004'),
('H2005','Nora','Australian Shepherd','2021-09-10','K1005'),
('H2006','Milo','Beagle','2018-03-15','K1006');
