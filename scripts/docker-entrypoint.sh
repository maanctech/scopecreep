#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(node -e '
    const url = new URL(`postgresql://${process.env.SCOPELEDGER_DB_HOST}:${process.env.SCOPELEDGER_DB_PORT}/${process.env.SCOPELEDGER_DB_NAME}`);
    url.username = process.env.SCOPELEDGER_DB_USER;
    url.password = process.env.SCOPELEDGER_DB_PASSWORD;
    process.stdout.write(url.toString());
  ')"
  export DATABASE_URL
fi

npm run config:check
npm run db:wait

if [ "${SCOPELEDGER_SKIP_MIGRATIONS:-false}" != "true" ]; then
  npm run db:migrate
fi

npm run rls:check

exec "$@"
