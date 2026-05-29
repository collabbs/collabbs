-- 0016_affiliate_events_brand_select.sql
-- La marque peut lire les événements (clics/ventes) des liens de SES campagnes,
-- pour afficher les stats côté marque (s'ajoute à la policy créateur existante).
create policy "affiliate_events_select_brand"
  on affiliate_events for select
  to authenticated
  using (
    exists (
      select 1
      from affiliate_links l
      join campaigns c on c.id = l.campaign_id
      where l.id = affiliate_events.link_id and c.brand_id = auth.uid()
    )
  );
