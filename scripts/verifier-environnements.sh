#!/usr/bin/env bash
# Quelle variable vient de quel fichier ? Et laquelle est HÉRITÉE ?
#
#   bash scripts/verifier-environnements.sh
#
# Pourquoi
# --------
# Next lit une variable dans `.env.$(NODE_ENV).local`, PUIS dans `.env.local`,
# et s'arrête à la première trouvée (vérifié dans la doc de la version
# installée, `environment-variables.md`). Une variable absente du fichier de
# développement est donc lue dans celui de production, en silence.
#
# Constaté le 23/10/2026 : `.env.local` porte la base de PRODUCTION mais une
# clé Stripe de TEST, et `.env.development.local` n'a ni Stripe ni Resend. Le
# serveur local tournait donc avec la base de développement ET les clés du
# fichier de production. C'est ce mélange qui a fait écrire, le 22/10, que
# Stripe tournait en mode test en production — une affirmation fausse tirée
# d'un fichier qui mélange les deux mondes.
#
# Ce script ne corrige rien : il rend l'héritage VISIBLE, pour qu'il cesse
# d'être une surprise.
#
# Ce qu'il n'affiche jamais
# -------------------------
# Aucune valeur, aucun préfixe, aucune longueur. Seulement : présente ou pas,
# et dans quel fichier. Les deux fichiers restent hors git.
set -u
cd "$(dirname "$0")/.." || exit 1

DEV=".env.development.local"
PROD=".env.local"

presente() { # $1 = fichier, $2 = variable
  [ -f "$1" ] && grep -qE "^$2=.+" "$1"
}

echo
echo "Variables du produit, et d'où elles viennent en développement"
echo "────────────────────────────────────────────────────────────"
printf "  %-38s %-12s %s\n" "VARIABLE" "dev" "effet en local"
echo

# Les variables qui comptent. Les deux premières décident de la BASE, les
# autres décident de ce qu'on fait au monde extérieur : argent et courriel.
for v in \
  NEXT_PUBLIC_SUPABASE_URL \
  SUPABASE_SECRET_KEY \
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
  STRIPE_SECRET_KEY \
  STRIPE_WEBHOOK_SECRET \
  RESEND_API_KEY \
  YOUTUBE_API_KEY \
  SHOPIFY_WEBHOOK_SECRET \
  CRON_SECRET
do
  if presente "$DEV" "$v"; then
    printf "  %-38s %-12s %s\n" "$v" "définie" "le fichier de dev gagne"
  elif presente "$PROD" "$v"; then
    printf "  %-38s %-12s \033[33m%s\033[0m\n" "$v" "absente" "HÉRITÉE de $PROD"
  else
    printf "  %-38s %-12s %s\n" "$v" "absente" "absente partout"
  fi
done

echo
echo "Sur quel projet Supabase pointe chaque fichier"
echo "──────────────────────────────────────────────"
for f in "$DEV" "$PROD"; do
  if [ -f "$f" ]; then
    ref=$(grep -m1 "^NEXT_PUBLIC_SUPABASE_URL=" "$f" | grep -oE '//[a-z]+\.' | tr -d '/.')
    printf "  %-28s %s\n" "$f" "${ref:-(aucune)}"
  else
    printf "  %-28s %s\n" "$f" "(fichier absent)"
  fi
done

echo
echo "Mode des clés Stripe, sans afficher les clés"
echo "───────────────────────────────────────────"
for f in "$DEV" "$PROD"; do
  if [ -f "$f" ] && grep -qE "^STRIPE_SECRET_KEY=.+" "$f"; then
    if grep -qE "^STRIPE_SECRET_KEY=[\"']?sk_live_" "$f"; then m="RÉEL";
    elif grep -qE "^STRIPE_SECRET_KEY=[\"']?sk_test_" "$f"; then m="test";
    else m="préfixe non reconnu"; fi
    printf "  %-28s %s\n" "$f" "$m"
  else
    printf "  %-28s %s\n" "$f" "(pas de clé Stripe)"
  fi
done

echo
echo "Ce qu'il faudrait"
echo "─────────────────"
echo "  Chaque fichier complet pour SON monde, aucune variable héritée."
echo "  En pratique, à ajouter dans $DEV : la clé Stripe de TEST, le secret"
echo "  de webhook Stripe du mode test, et une clé Resend distincte (ou"
echo "  aucune : hors production, l'envoi est de toute façon refusé vers"
echo "  une vraie adresse — voir le garde-fou de lib/notifications.ts)."
echo
echo "  Deux garde-fous couvrent déjà le pire, même sans rien changer :"
echo "    · une clé sk_live_ refuse de démarrer hors production (lib/stripe.ts)"
echo "    · hors production, aucun courriel ne part vers une vraie adresse"
echo
