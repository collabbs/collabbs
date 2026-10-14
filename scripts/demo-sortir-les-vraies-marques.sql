-- ═══════════════════════════════════════════════════════════════════════════
-- Sortir toute trace d'entreprises réelles du catalogue de démonstration
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Pourquoi, et pourquoi en quatre endroits ───
-- Le 14/10/2026, les 34 marques de démonstration ont été renommées
-- (`brands.name`). Un balayage de TOUS les champs texte, insensible à la casse,
-- a montré que ça ne faisait qu'un tiers du travail : les vrais noms survivaient
-- à trois autres endroits, et l'un d'eux est grave.
--
--   · `profiles.display_name` — 32 noms réels. C'est le nom affiché, celui que
--     portent notamment les 73 avis cinq étoiles inventés.
--
--   · `brands.logo_url` — des URL de type
--     `google.com/s2/favicons?domain=sephora.com` : elles vont chercher le VRAI
--     logo de l'entreprise, à chaque affichage.
--
--   · `brands.website` — 34 adresses pointant vers les vraies boutiques.
--
--   · `campaigns.target_url` / `product_url` — des liens d'affiliation qui
--     envoient vers `sephora.fr`, `lululemon.com`, `gymshark.com`,
--     `traderepublic.com`. **Un créateur qui active un de ces liens enverrait
--     du trafic réel chez une entreprise qui n'a rien demandé**, sous une
--     promesse de commission qui n'existe pas.
--
-- ─── Ce que ça ne remet pas en cause ───
-- La décision du 03/09 de peupler le catalogue avec des profils de
-- démonstration. Fiches, avis et chiffres restent en place ; seuls les noms,
-- les logos et les liens changent.
--
-- Logos et sites passent à NULL plutôt qu'à une valeur inventée : l'interface
-- retombe sur les initiales, et une adresse fictive serait un mensonge de plus.
--
-- Les trois blocs sont séparés et renvoient chacun ce qu'ils ont touché.
-- Rien n'est fait en silence.

-- ── 1. Le nom affiché, aligné sur le nom déjà renommé de la marque ─────────
update public.profiles p
   set display_name = b.name
  from public.brands b
 where b.id = p.id
   and b.is_demo = true
   and p.display_name is distinct from b.name
returning p.id, p.display_name as nouveau_nom_affiche;


-- ── 2. Sites et logos : ils pointent vers les vraies entreprises ───────────
update public.brands
   set website    = null,
       logo_url   = null,
       updated_at = now()
 where is_demo = true
   and (website is not null or logo_url is not null)
returning name, 'site et logo retirés' as resultat;


-- ── 3. Les liens d'affiliation vers les vraies boutiques ──────────────────
update public.campaigns c
   set target_url  = null,
       product_url = null
  from public.brands b
 where b.id = c.brand_id
   and b.is_demo = true
   and (c.target_url is not null or c.product_url is not null)
returning c.id, b.name as marque, 'liens neutralisés' as resultat;
