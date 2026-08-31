-- ============================================================
-- Collabbs · 0061 — la régularisation de provision, enfin possible
-- ------------------------------------------------------------
-- `ledger_kind` contient `adjustment` depuis la migration 0035, avec ce
-- commentaire : « correction manuelle (litige, geste commercial) ». La page de
-- facturation sait même l'afficher — elle l'appelle « Régularisation ».
--
-- **Aucune fonction ne sait en écrire une.** `credit_balance` refuse les
-- montants négatifs, et c'est la seule porte d'entrée : la règle posée en 0035
-- interdit de toucher `brands.balance` directement, et elle a raison de le
-- faire. Résultat : une catégorie déclarée, un libellé prêt à l'écran, et
-- aucune capacité derrière. Un litige à trancher, un geste commercial, un
-- approvisionnement de test à annuler — rien de tout cela n'était réalisable
-- autrement qu'en écrivant dans la table à la main, c'est-à-dire en cassant la
-- seule règle qui protège le registre.
--
-- Cette fonction est le pendant signé de `credit_balance`, avec trois
-- garde-fous que le crédit n'a pas besoin d'avoir :
--
--  1. **Le motif est obligatoire.** Un mouvement d'argent sans raison écrite
--     est indéfendable trois mois plus tard, devant la marque comme devant
--     nous-mêmes.
--  2. **La provision ne peut pas passer sous zéro.** Une provision négative
--     n'existe pas : elle signifierait qu'on a réservé des commissions sur de
--     l'argent qu'on ne détient pas.
--  3. **Réservée au service_role**, comme tout ce qui déplace de l'argent. Le
--     navigateur n'a jamais eu accès à ces fonctions et n'en aura jamais.
-- ============================================================

create or replace function public.adjust_balance(
  p_brand  uuid,
  p_amount numeric,       -- SIGNÉ : positif crédite, négatif débite
  p_label  text
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric(12,2);
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'adjust_balance : montant nul';
  end if;
  if p_label is null or btrim(p_label) = '' then
    raise exception 'adjust_balance : motif obligatoire';
  end if;

  -- Verrou sur la ligne : deux régularisations simultanées se liraient sinon
  -- le même solde de départ et la seconde écraserait la première.
  select balance into v_balance from public.brands where id = p_brand for update;
  if not found then
    raise exception 'adjust_balance : marque introuvable';
  end if;

  v_balance := round(v_balance + p_amount, 2);
  if v_balance < 0 then
    raise exception 'adjust_balance : provision insuffisante (solde % , ajustement %)',
      round(v_balance - p_amount, 2), p_amount;
  end if;

  update public.brands set balance = v_balance where id = p_brand;

  -- La colonne s'appelle `affiliate_event_id`, pas `event_id` : une régularisation
  -- n'est rattachée à aucune vente, mais autant nommer juste ce qu'on laisse à NULL.
  insert into public.brand_ledger (brand_id, kind, amount, balance_after, affiliate_event_id, stripe_ref, label)
  values (p_brand, 'adjustment', round(p_amount, 2), v_balance, null, null, btrim(p_label));

  return v_balance;
end;
$$;

revoke execute on function public.adjust_balance(uuid, numeric, text) from public, anon, authenticated;
grant  execute on function public.adjust_balance(uuid, numeric, text) to service_role;
