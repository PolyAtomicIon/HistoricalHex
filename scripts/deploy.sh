#!/usr/bin/env bash
# Выкладка HistoricalHex на https://bekzaty.abmco.kz/catan/
#   scripts/deploy.sh          — клиент + сервер
#   scripts/deploy.sh --setup  — первый раз: systemd-служба и блок nginx
set -euo pipefail
cd "$(dirname "$0")/.."
HOST=root@77.246.247.9
SSH="ssh -o BatchMode=yes"

VITE_BASE=/catan/ npx vite build
npm run -s build:server

rsync -az --delete -e "$SSH" dist/ $HOST:/var/www/catan/
$SSH $HOST 'mkdir -p /opt/historicalhex'
rsync -az -e "$SSH" dist-server/server.mjs $HOST:/opt/historicalhex/server.mjs
$SSH $HOST 'chown -R www-data:www-data /var/www/catan /opt/historicalhex'

if [[ "${1:-}" == "--setup" ]]; then
  rsync -az -e "$SSH" deploy/historicalhex.service $HOST:/etc/systemd/system/historicalhex.service
  rsync -az -e "$SSH" deploy/nginx-catan.conf $HOST:/etc/nginx/snippets/historicalhex.conf
  $SSH $HOST 'systemctl daemon-reload && systemctl enable historicalhex'
  echo "Add 'include snippets/historicalhex.conf;' to the bekzaty.abmco.kz server block, then nginx -t && systemctl reload nginx"
fi

$SSH $HOST 'systemctl restart historicalhex && sleep 1 && systemctl is-active historicalhex'
curl -s -o /dev/null -w 'page: %{http_code} https://bekzaty.abmco.kz/catan/\n' https://bekzaty.abmco.kz/catan/
