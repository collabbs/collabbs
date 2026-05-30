-- 0021 — Tracking des ventes affiliées : authentifié et idempotent
--
-- 1) Clé secrète par marque (auto-générée). La marque la pose dans l'en-tête
--    Authorization du postback pour s'authentifier.
-- 2) Idempotence : on stocke l'identifiant de commande externe (ex. ORD-1234)
--    et un index unique partiel empêche le double comptage d'une même vente.

alter table public.brands
  add column if not exists postback_secret text;

-- Génère une clé pour les marques existantes.
update public.brands
  set postback_secret = encode(extensions.gen_random_bytes(24), 'hex')
  where postback_secret is null;

alter table public.brands
  alter column postback_secret set default encode(extensions.gen_random_bytes(24), 'hex'),
  alter column postback_secret set not null;

create unique index if not exists brands_postback_secret_unique
  on public.brands(postback_secret);

alter table public.affiliate_events
  add column if not exists external_ref text;

-- Une même vente (même order_id) ne peut être comptée 2 fois pour un lien.
create unique index if not exists affiliate_events_sale_dedup
  on public.affiliate_events(link_id, external_ref)
  where type = 'sale' and external_ref is not null;