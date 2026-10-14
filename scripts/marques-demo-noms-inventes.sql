-- ═══════════════════════════════════════════════════════════════════════════
-- Donner des noms INVENTÉS aux marques de démonstration
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Le constat (14/10/2026) ───
-- Le catalogue de démonstration est bâti sur des noms d'entreprises RÉELLES :
-- Sephora, Gymshark, NordVPN, Lululemon, Anker, Trade Republic, Veja,
-- Decathlon, Sézane… Les marques elles-mêmes sont masquées en production, mais
-- **leurs noms ressortent par les avis** affichés sur les fiches créateurs :
--
--     73 avis cinq étoiles inventés, publiés au nom de 6 entreprises réelles,
--     visibles par n'importe quel visiteur.
--
-- Exemple lu sur `/creators/noahplays` :
--     « NordVPN ★★★★★ — Qualité de production au top. »
--     « Gymshark ★★★★★ — Créateur·rice à l'écoute, brief parfaitement
--       respecté. »
--
-- Ces entreprises n'ont rien recommandé. Un témoignage inventé attribué
-- nommément à une société identifiable est une pratique commerciale trompeuse
-- (art. L121-2 du code de la consommation), et c'est la première chose que voit
-- une marque qui découvre Collabbs.
--
-- ─── Ce que ce script ne remet PAS en cause ───
-- La décision du 03/09 de peupler le catalogue avec des profils de
-- démonstration — « un catalogue à une seule fiche ne convertit personne » —
-- reste entière. Les fiches, les avis, les chiffres ne bougent pas. Seuls les
-- NOMS changent, et le risque disparaît avec eux.
--
-- Les noms proposés ci-dessous sont inventés et plausibles, dans la même niche
-- que l'original pour que les avis gardent leur sens. À valider par Julien : ce
-- sont des noms, pas une vérité technique.
--
-- La requête renvoie l'ancien et le nouveau nom : rien n'est fait en silence,
-- et le retour en arrière reste lisible.

with nouveaux(ancien, nouveau) as (
  values
    ('Sephora',          'Belline'),
    ('Gymshark',         'Ironwave'),
    ('NordVPN',          'Cloisonne'),
    ('Lululemon',        'Studio Mila'),
    ('Anker',            'Voltique'),
    ('Trade Republic',   'Épargne Simple'),
    ('Typology',         'Peau Nette'),
    ('Respire',          'Fraîche'),
    ('Horace',           'Barbier Moderne'),
    ('Cut by Fred',      'Boucle & Co'),
    ('Nocibé',           'Parfumerie Lune'),
    ('Sézane',           'Atelier Margaux'),
    ('Loom',             'Coupe Durable'),
    ('Le Slip Français', 'Le Coton Juste'),
    ('Asphalte',         'Bitume & Fil'),
    ('Le Pantalon',      'La Jambe Droite'),
    ('Sessùn',           'Maison Avril'),
    ('Archiduchesse',    'Chaussette Royale'),
    ('Balzac Paris',     'Rivoli Studio'),
    ('Cabaia',           'Bonnet Bleu'),
    ('Veja',             'Pas Léger'),
    ('Decathlon',        'Grand Terrain'),
    ('Le Coq Sportif',   'Le Héron Sportif'),
    ('Hast',             'Chemise Nette'),
    ('Bobochic',         'Salon Doux'),
    ('Leroy Merlin',     'Atelier Maison'),
    ('Moulin Roty',      'Petit Moulin'),
    ('Lunii',            'Conteuse'),
    ('Boulanger',        'Électro Plus'),
    ('Fnac',             'Comptoir Culture'),
    ('Jimmy Fairly',     'Monture Claire'),
    ('Jho',              'Cycle Serein'),
    ('Pimpant',          'Flacon Vide'),
    ('Patine',           'Cuir Patiné')
)
update public.brands b
   set name       = n.nouveau,
       updated_at = now()
  from nouveaux n
 where b.name = n.ancien
   and b.is_demo = true          -- jamais une marque réelle, même homonyme
returning n.ancien as nom_avant, b.name as nom_apres;
