-- ================
-- DEMO KLANTEN
-- ================
insert into public.klanten (naam, email, telefoon, adres)
values
  ('Jan Janssens', 'jan@example.com', '+32 471 11 22 33', 'Dorpsstraat 1, 2400 Mol'),
  ('Sofie Peeters', 'sofie@example.com', '+32 495 44 55 66', 'Markt 12, 2300 Turnhout')
on conflict (email) do nothing;

-- ================
-- DEMO HONDEN
-- ================
with
  jan as (select id from public.klanten where email='jan@example.com' limit 1),
  sof as (select id from public.klanten where email='sofie@example.com' limit 1)
insert into public.honden (eigenaar_id, naam, ras, chip, geboortedatum)
values
  ((select id from jan), 'Bobby', 'Labrador', 'BE-123', '2022-04-10'),
  ((select id from jan), 'Luna',  'Border Collie', 'BE-456', '2023-01-05'),
  ((select id from sof), 'Max',   'Beagle', 'BE-789', '2021-11-20')
on conflict (chip) do nothing;

-- ================
-- DEMO REEKS
-- ================
insert into public.reeksen
  (naam, type, thema, aantal_strippen, max_deelnemers, lesduur_minuten, geldigheidsduur_weken, prijs_excl, status, omschrijving, is_public)
values
  ('Puppy – Groep A', 'Puppy', 'Start', 6, 8, 60, 8, 120.00, 'Actief', 'Basisreeks voor jonge honden.', true)
on conflict (naam) do nothing;

-- ================
-- DEMO LESSEN
-- ================
with r as (select id from public.reeksen where naam='Puppy – Groep A' limit 1)
insert into public.lessen (reeks_id, datum, starttijd, eindtijd, trainer, locatie, is_public)
values
  ((select id from r), current_date + interval '2 day', time '19:00', time '20:00', 'Trainer Ann', 'Terrein Retie', true),
  ((select id from r), current_date + interval '5 day', time '19:00', time '20:00', 'Trainer Bart', 'Terrein Retie', true),
  ((select id from r), current_date + interval '9 day', time '10:00', time '11:00', 'Trainer Ann', 'Hal Turnhout', true)
on conflict do nothing;

-- ================
-- DEMO MEDEDELING
-- ================
with r as (select id from public.reeksen where naam='Puppy – Groep A' limit 1)
insert into public.mededelingen (titel, tekst, reeks_id, kanalen, is_public)
values
  ('Parking afgesloten', 'Let op: zaterdag is de parking niet bereikbaar. Gelieve te parkeren aan de overkant.', (select id from r), array['dashboard','mail'], true)
on conflict do nothing;

-- ================
-- DEMO INSCHRIJVING
-- ================
with
  hond as (select id, eigenaar_id from public.honden where naam='Bobby' limit 1),
  les  as (select id from public.lessen order by datum asc limit 1)
insert into public.inschrijvingen (klant_id, hond_id, les_id, status)
values (
  (select eigenaar_id from hond),
  (select id from hond),
  (select id from les),
  'aangemeld'
)
on conflict do nothing;

-- ================
-- TEST: publieke agenda bekijken
-- ================
select * from public.get_public_agenda(current_date);
