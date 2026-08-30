-- Rendre les contrats-cadres visibles à leurs parties
--
-- Les règles d'accès de `contracts` (migration 0004) ont été écrites quand un
-- contrat était forcément adossé à une collaboration :
--
--   exists (select 1 from deals d where d.id = deal_id
--           and (d.brand_id = auth.uid() or d.creator_id = auth.uid()))
--
-- Un contrat-cadre d'affiliation n'a pas de collaboration : `deal_id` est nul,
-- la sous-requête ne trouve rien, et le contrat devient **invisible à ses
-- propres parties**. Un contrat qu'on ne peut pas lire ne se signe jamais.
--
-- On étend donc la lecture aux deux parties nommées sur le contrat lui-même.
--
-- L'écriture reste fermée : les signatures passent par le service_role, après
-- vérification côté serveur que l'utilisateur est bien l'une des parties.
-- C'est le même parti pris que pour l'administration — aucune règle n'accorde
-- de privilège d'écriture, tout passe par un contrôle applicatif explicite.

drop policy if exists "contracts_select" on public.contracts;
create policy "contracts_select" on public.contracts
  for select using (
    exists (
      select 1 from public.deals d
      where d.id = deal_id
        and (d.brand_id = auth.uid() or d.creator_id = auth.uid())
    )
    or brand_id = auth.uid()
    or creator_id = auth.uid()
  );
