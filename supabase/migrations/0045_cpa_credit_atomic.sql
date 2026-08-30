-- Crédit CPA atomique
--
-- Le crédit d'un palier se calcule à partir de ce qui a DÉJÀ été crédité au
-- créateur : on ne verse que la différence. Si la marque déclare deux actions
-- en même temps, les deux appels peuvent lire la même somme et créditer chacun
-- le palier entier — un double paiement, en argent réel.
--
-- Cette fonction rend l'opération atomique. Elle NE contient PAS la logique des
-- paliers : celle-ci reste en TypeScript (`lib/cpa.ts`), en un seul endroit,
-- testée. L'appelant lui passe simplement le total gagné au niveau atteint ;
-- la fonction verrouille les lignes du lien, relit la somme déjà créditée, et
-- n'écrit que l'écart.
--
-- Conséquence utile : un appelant qui aurait lu un cumul périmé crédite moins
-- que dû, jamais plus — et la déclaration suivante rattrape. On ne peut pas
-- sur-payer, seulement rattraper.

create or replace function public.credit_cpa_action(
  p_link  uuid,
  p_event uuid,
  p_total numeric
) returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_deja numeric(12,2);
  v_ecart numeric(12,2);
begin
  -- Verrou sur la ligne du lien — une seule, donc un point de rendez-vous sûr.
  -- Deux déclarations simultanées sur le même lien s'exécutent l'une après
  -- l'autre. (On ne peut pas verrouiller directement les lignes agrégées :
  -- Postgres refuse `FOR UPDATE` avec une fonction d'agrégat.)
  perform 1 from public.affiliate_links where id = p_link for update;

  select coalesce(sum(commission_amount), 0) into v_deja
  from public.affiliate_events
  where link_id = p_link and type = 'action';

  v_ecart := round(greatest(0, coalesce(p_total, 0) - v_deja), 2);
  if v_ecart <= 0 then
    return 0;
  end if;

  update public.affiliate_events
     set commission_amount = v_ecart
   where id = p_event;

  return v_ecart;
end $$;

revoke all on function public.credit_cpa_action(uuid, uuid, numeric) from public, anon, authenticated;
grant execute on function public.credit_cpa_action(uuid, uuid, numeric) to service_role;

comment on function public.credit_cpa_action is
  'Crédite atomiquement l''écart entre le total CPA gagné et ce qui a déjà été versé sur ce lien. La logique des paliers reste côté application.';
