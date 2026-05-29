-- 0020 — Compte Stripe connecté du créateur (pour recevoir les versements)
--
-- Les créateurs reçoivent l'argent via un compte Stripe Connect (Express).
-- On stocke l'id du compte connecté (acct_…) une fois l'onboarding lancé.
alter table public.creators
  add column if not exists stripe_account_id text;
