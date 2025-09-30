-- Extensions
create extension if not exists pgcrypto;
create extension if not exists uuid-ossp;

-- =========================
-- T A B E L L E N
-- =========================

-- 1) Klanten (gekoppeld aan auth.users via user_id)
create table if not exists public.klanten (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique, -- nullable: admins/legacy kunnen klanten zonder user hebben
  naam text not null,
  email text unique,
  telefoon text,
  adres text,
  created_at timestamptz not null default now()
);

-- 2) Honden (eigendom bij klant)
create table if not exists public.honden (
  id uuid primary key default gen_random_uuid(),
  eigenaar_id uuid not null references public.klanten (id) on delete cascade,
  naam text not null,
  ras text,
  chip text unique,
  geboortedatum date,
  created_at timestamptz not null default now()
);
create index if not exists honden_owner_idx on public.honden (eigenaar_id);

-- 3) Reeksen
create table if not exists public.reeksen (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  type text,
  thema text,
  aantal_strippen int,
  max_deelnemers int,
  lesduur_minuten int,
  geldigheidsduur_weken int,
  prijs_excl numeric(10,2),
  status text default 'Actief',
  omschrijving text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

-- 4) Lessen (horen bij reeks)
create table if not exists public.lessen (
  id uuid primary key default gen_random_uuid(),
  reeks_id uuid references public.reeksen (id) on delete set null,
  datum date not null,
  starttijd time without time zone,
  eindtijd time without time zone,
  trainer text,
  locatie text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists lessen_reeks_idx on public.lessen (reeks_id);
create index if not exists lessen_datum_idx on public.lessen (datum);

-- 5) Inschrijvingen (koppeling hond/klant aan les)
create type public.inschrijf_status as enum ('aangemeld','aanwezig','afgemeld','geannuleerd');

create table if not exists public.inschrijvingen (
  id uuid primary key default gen_random_uuid(),
  klant_id uuid not null references public.klanten (id) on delete cascade,
  hond_id uuid not null references public.honden (id) on delete cascade,
  les_id uuid not null references public.lessen (id) on delete cascade,
  status public.inschrijf_status not null default 'aangemeld',
  opmerking text,
  created_at timestamptz not null default now(),
  unique (hond_id, les_id)
);
create index if not exists insch_lesson_idx on public.inschrijvingen (les_id);
create index if not exists insch_owner_idx on public.inschrijvingen (klant_id);

-- 6) Mededelingen (optioneel gekoppeld aan les of reeks)
create table if not exists public.mededelingen (
  id uuid primary key default gen_random_uuid(),
  titel text not null,
  tekst text,
  aangemaakt_op timestamptz not null default now(),
  les_id uuid references public.lessen (id) on delete set null,
  reeks_id uuid references public.reeksen (id) on delete set null,
  kanalen text[] default array['dashboard']::text[],
  is_public boolean not null default true
);
create index if not exists mededelingen_public_idx on public.mededelingen (is_public);

-- =========================
-- R L S   (Row Level Security)
-- =========================

alter table public.klanten        enable row level security;
alter table public.honden         enable row level security;
alter table public.reeksen        enable row level security;
alter table public.lessen         enable row level security;
alter table public.inschrijvingen enable row level security;
alter table public.mededelingen   enable row level security;

-- Helper: mapping auth.uid() → klant.id
-- We verwachten dat klanten.user_id = auth.uid() (als de klant een login heeft).
-- Admins gebruiken de Service Role key (bypasst RLS automatisch).

-- 1) Klanten: eigen record lezen/bewerken
create policy klanten_self_select
  on public.klanten
  for select
  using (user_id = auth.uid());

create policy klanten_self_update
  on public.klanten
  for update
  using (user_id = auth.uid());

-- (Admins/service role: geen policy nodig, bypass RLS.)

-- 2) Honden: alleen honden zien/beheren van je eigen klantrecord
create policy honden_owner_select
  on public.honden
  for select
  using (
    exists (
      select 1 from public.klanten k
      where k.id = honden.eigenaar_id and k.user_id = auth.uid()
    )
  );

create policy honden_owner_modify
  on public.honden
  for all
  using (
    exists (
      select 1 from public.klanten k
      where k.id = honden.eigenaar_id and k.user_id = auth.uid()
    )
  );

-- 3) Inschrijvingen: alleen jouw eigen (via klant_id → user_id)
create policy inschrijvingen_self
  on public.inschrijvingen
  for all
  using (
    exists (
      select 1 from public.klanten k
      where k.id = inschrijvingen.klant_id and k.user_id = auth.uid()
    )
  );

-- 4) Lessen & Reeksen & Mededelingen:
--    publiek leesbaar als is_public = true (voor agenda/website)
create policy reeksen_public_read
  on public.reeksen
  for select
  using (is_public = true);

create policy lessen_public_read
  on public.lessen
  for select
  using (is_public = true);

create policy mededelingen_public_read
  on public.mededelingen
  for select
  using (is_public = true);

-- (Optioneel: authenticated users mogen meer zien, voeg extra policies toe.)

-- =========================
-- P U B L I E K E  A G E N D A  R P C
-- =========================

-- Simpele RPC die de agenda teruggeeft (kan je later uitbreiden/joins toevoegen)
create or replace function public.get_public_agenda(from_date date default null)
returns table(
  datum timestamptz,
  titel text,
  type text,
  href text
) language sql stable as $$
  select
    -- combineer datum + starttijd tot timestamp (fallback 00:00)
    (l.datum::timestamptz + coalesce(l.starttijd, '00:00'::time)) as datum,
    coalesce(r.naam, 'Les') as titel,
    'Les'::text as type,
    concat('/lessen/detail.html?id=', l.id::text) as href
  from public.lessen l
  left join public.reeksen r on r.id = l.reeks_id
  where l.is_public = true
    and (from_date is null or l.datum >= from_date)
  order by l.datum asc, l.starttijd asc
$$;
