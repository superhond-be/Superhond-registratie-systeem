-- V1.3 schema with dummy data
CREATE TABLE landen (
  code CHAR(2) PRIMARY KEY,
  naam VARCHAR(64) NOT NULL
);

CREATE TABLE klanten (
  id SERIAL PRIMARY KEY,
  voornaam VARCHAR(80),
  achternaam VARCHAR(120),
  email VARCHAR(190),
  land_code CHAR(2) REFERENCES landen(code),
  straat VARCHAR(120),
  huisnummer VARCHAR(20),
  toevoeging VARCHAR(10),
  postcode VARCHAR(10),
  plaats VARCHAR(120),
  tel_e164 VARCHAR(20)
);

CREATE TABLE honden (
  id SERIAL PRIMARY KEY,
  klant_id INT REFERENCES klanten(id),
  naam VARCHAR(80),
  ras VARCHAR(120),
  geboortedatum DATE
);

INSERT INTO landen (code,naam) VALUES ('BE','België'),('NL','Nederland');

INSERT INTO klanten (voornaam,achternaam,email,land_code,straat,huisnummer,postcode,plaats,tel_e164)
VALUES ('Jan','Janssens','jan@voorbeeld.be','BE','Kerkstraat','12','2000','Antwerpen','+32470123456'),
       ('Piet','de Vries','piet@example.nl','NL','Dorpsstraat','5','1234AB','Utrecht','+31612345678');

INSERT INTO honden (klant_id,naam,ras,geboortedatum)
VALUES (1,'Rocco','Mechelse herder','2021-06-15'),
       (2,'Luna','Labrador','2019-03-09');
