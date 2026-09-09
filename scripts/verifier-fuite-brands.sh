#!/usr/bin/env bash
# Le secret de postback est-il lisible depuis le navigateur ?
#
# La cle « anon » est publique : elle est dans le code de chaque page. Ce
# script se fait donc passer pour un visiteur ordinaire et demande a la base
# les colonnes qui ne devraient jamais lui repondre. Il n'affiche AUCUNE
# valeur — seulement ouvert / ferme.
#
#   bash scripts/verifier-fuite-brands.sh
#
# A lancer deux fois : avant la migration 0068 (attendu : OUVERT) et apres
# (attendu : FERME). C'est la seule preuve qui vaille.
set -u
cd "$(dirname "$0")/.." || exit 1

lire() { grep -h "^$1=" .env.local .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"'\r'; }
URL=$(lire NEXT_PUBLIC_SUPABASE_URL)
ANON=$(lire NEXT_PUBLIC_SUPABASE_ANON_KEY)
if [ -z "${URL:-}" ] || [ -z "${ANON:-}" ]; then
  echo "Cles introuvables dans .env.local — lance ce script depuis le depot collabbs."
  exit 1
fi

essai() { # $1 = colonne
  local rep
  rep=$(curl -s -o /dev/null -w "%{http_code}" \
    "$URL/rest/v1/brands?select=$1&limit=1" \
    -H "apikey: $ANON" -H "Authorization: Bearer $ANON")
  if [ "$rep" = "200" ]; then
    printf '  %-22s OUVERT   (lisible par n%s importe qui)\n' "$1" "'"
  else
    printf '  %-22s ferme    (HTTP %s)\n' "$1" "$rep"
  fi
}

echo "Table brands, vue par un visiteur non connecte :"
for c in postback_secret balance plan payment_method_id stripe_customer_id name; do essai "$c"; done
echo
echo "Attendu apres 0068 : seule la derniere ligne (name) doit etre OUVERTE."
