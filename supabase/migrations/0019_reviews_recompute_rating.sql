-- 0019 — Agrégat de note créateur tenu à jour par trigger
--
-- Un avis est écrit par la marque (RLS : brand_id = auth.uid()), mais la note
-- moyenne et le nombre d'avis vivent sur la ligne `creators` (que la marque ne
-- peut pas modifier). Un trigger SECURITY DEFINER recalcule l'agrégat à chaque
-- insertion / modification / suppression d'avis.

create or replace function public.recompute_creator_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator uuid;
begin
  v_creator := coalesce(new.creator_id, old.creator_id);
  update public.creators c set
    reviews_count = (select count(*) from public.reviews r where r.creator_id = v_creator),
    rating = coalesce(
      (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.creator_id = v_creator),
      c.rating
    )
  where c.id = v_creator;
  return null;
end;
$$;

revoke execute on function public.recompute_creator_rating() from public, anon, authenticated;

drop trigger if exists trg_reviews_recompute on public.reviews;
create trigger trg_reviews_recompute
after insert or update or delete on public.reviews
for each row execute function public.recompute_creator_rating();
