-- ═══════════════════════════════════════════════════════════════════════════
-- Sortir les entreprises réelles du catalogue de démonstration
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Les 34 marques ont déjà été renommées. Un balayage de TOUS les champs texte,
-- insensible à la casse, a montré que ça ne suffisait pas : les vrais noms
-- survivaient à trois autres endroits.
--
--   · `profiles.display_name` — 32 noms réels. C'est le nom AFFICHÉ, celui que
--     portent notamment les 73 avis cinq étoiles inventés.
--   · `brands.logo_url` — des URL `google.com/s2/favicons?domain=sephora.com`
--     qui vont chercher le VRAI logo de l'entreprise à chaque affichage.
--   · `brands.website` — 34 adresses vers les vraies boutiques.
--   · `campaigns.target_url` — des liens d'affiliation vers sephora.fr,
--     lululemon.com, gymshark.com. **Un créateur qui active un de ces liens
--     enverrait du trafic réel chez une entreprise qui n'a rien demandé**,
--     sous une promesse de commission qui n'existe pas.
--
-- Les logos ne sont pas effacés mais REMPLACÉS : 34 monogrammes dessinés,
-- livrés dans le dépôt (`public/demo-logos/`). Le catalogue garde son allure.
--
-- Quatre blocs séparés, chacun renvoie ce qu'il a touché. Rien en silence.
-- À exécuter l'un après l'autre dans le SQL Editor de Supabase.


-- ── 1. Le nom affiché, aligné sur le nom déjà renommé ──────────────────────
update public.profiles p
   set display_name = b.name
  from public.brands b
 where b.id = p.id and b.is_demo = true
   and p.display_name is distinct from b.name
returning p.id, p.display_name as nouveau_nom;


-- ── 2. Les nouveaux logos ──────────────────────────────────────────────────
update public.brands b
   set logo_url = v.chemin, updated_at = now()
  from (values
    ('66995afa-7ba6-47e6-8915-8e44005d1188', '/demo-logos/atelier-maison.svg'),
    ('33bb163a-1e13-44b5-871a-22d970cc894d', '/demo-logos/atelier-margaux.svg'),
    ('618c4e66-51aa-481b-8a1e-48c979f61c81', '/demo-logos/barbier-moderne.svg'),
    ('583d041b-dd60-47e0-9527-54b4197b9429', '/demo-logos/belline.svg'),
    ('0cc7e61a-5d3b-4a01-b47d-385c8b16cf9d', '/demo-logos/bitume-fil.svg'),
    ('8af60dbc-0651-4daa-b915-11d871470040', '/demo-logos/bonnet-bleu.svg'),
    ('948f1336-df9f-4737-9986-776b59ac726f', '/demo-logos/boucle-co.svg'),
    ('1c207216-6a5a-49ac-be81-d19674f6b973', '/demo-logos/chaussette-royale.svg'),
    ('c5584106-16f2-440c-a5e3-be8d64ef3e47', '/demo-logos/chemise-nette.svg'),
    ('2aa78504-6ebb-4df8-9dcc-a059a2c1b2e4', '/demo-logos/cloisonne.svg'),
    ('71e3236d-1f23-4325-a7b0-54f97da4bf47', '/demo-logos/comptoir-culture.svg'),
    ('6093a61e-34ab-439b-a239-c847c4e766b3', '/demo-logos/conteuse.svg'),
    ('ba838456-dcab-4005-9510-f66a38f385dc', '/demo-logos/coupe-durable.svg'),
    ('5e9c0048-8f61-427a-9f50-4af5c9deb72c', '/demo-logos/cuir-patine.svg'),
    ('572ee477-2249-4861-9f47-6466bc7233c8', '/demo-logos/cycle-serein.svg'),
    ('3dff40a7-6171-4944-adde-9adbcd5d18e1', '/demo-logos/electro-plus.svg'),
    ('f8841c9f-9a4a-4082-beac-91c42592b7e4', '/demo-logos/epargne-simple.svg'),
    ('1f17cefb-6745-4613-83b9-24aaaab24dbf', '/demo-logos/flacon-vide.svg'),
    ('c03fd7d0-59ed-44ff-a9f8-1388ac0bfaf6', '/demo-logos/fraiche.svg'),
    ('031b4365-5cba-44bb-b6df-30aa075ae7ab', '/demo-logos/grand-terrain.svg'),
    ('0151499b-a616-4087-bd6e-f6e0f54aec4c', '/demo-logos/ironwave.svg'),
    ('6324597c-6afb-40a2-b269-b7edd361a173', '/demo-logos/la-jambe-droite.svg'),
    ('40d0e418-7a05-465b-86b1-fa4dfe7f682f', '/demo-logos/le-coton-juste.svg'),
    ('bcc28075-a7ec-4630-98fd-d8bf5013da15', '/demo-logos/le-heron-sportif.svg'),
    ('4b7d81cd-4fd1-428f-b434-cb72e1e6d7bb', '/demo-logos/maison-avril.svg'),
    ('98295187-5b22-4154-8249-2f38ed151043', '/demo-logos/monture-claire.svg'),
    ('a5d17cbd-6861-492c-a8e5-283d132b5d12', '/demo-logos/parfumerie-lune.svg'),
    ('e8d149ed-9ec6-4ca7-97c8-f4a24698ddda', '/demo-logos/pas-leger.svg'),
    ('a4313718-4f4a-4e56-b29e-996a0ea4bdbf', '/demo-logos/peau-nette.svg'),
    ('b737c801-5464-49f8-9988-7cfc20ce70cf', '/demo-logos/petit-moulin.svg'),
    ('fe02c304-2ea3-4ecb-b695-0557ebd5cf96', '/demo-logos/rivoli-studio.svg'),
    ('0a7e37d0-d68a-4a51-9f9c-21f5d9981438', '/demo-logos/salon-doux.svg'),
    ('ca018732-c76a-4cb6-a3ad-f00b137ebb3e', '/demo-logos/studio-mila.svg'),
    ('eb0af1df-229f-494c-bc48-13995a57c069', '/demo-logos/voltique.svg')
  ) as v(id, chemin)
 where b.id = v.id::uuid and b.is_demo = true
returning b.name, b.logo_url;


-- ── 3. Les sites pointant vers les vraies boutiques ────────────────────────
update public.brands
   set website = null, updated_at = now()
 where is_demo = true and website is not null
returning name, 'site retiré' as resultat;


-- ── 4. Les liens d'affiliation vers les vraies boutiques ───────────────────
--     C'est le bloc le plus important des quatre.
update public.campaigns c
   set target_url = null, product_url = null
  from public.brands b
 where b.id = c.brand_id and b.is_demo = true
   and (c.target_url is not null or c.product_url is not null)
returning c.id, b.name as marque, 'liens neutralisés' as resultat;
