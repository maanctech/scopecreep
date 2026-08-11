#!/bin/sh
set -eu

database_url() {
  SCOPELEDGER_URL_USER="$1" SCOPELEDGER_URL_PASSWORD="$2" node -e '
    const url = new URL(`postgresql://${process.env.SCOPELEDGER_DB_HOST}:${process.env.SCOPELEDGER_DB_PORT}/${process.env.SCOPELEDGER_DB_NAME}`);
    url.username = process.env.SCOPELEDGER_URL_USER;
    url.password = process.env.SCOPELEDGER_URL_PASSWORD;
    process.stdout.write(url.toString());
  '
}

# Migrations create tables, which needs rights that would also read past every
# tenant policy. The application therefore connects as a separate unprivileged
# role, and only this bootstrap uses the owning account.
MIGRATION_DATABASE_URL="$(database_url "${SCOPELEDGER_DB_USER}" "${SCOPELEDGER_DB_PASSWORD}")"

if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(database_url "${SCOPELEDGER_DB_APP_USER}" "${SCOPELEDGER_DB_APP_PASSWORD}")"
fi

export DATABASE_URL

npm run config:check
DATABASE_URL="$MIGRATION_DATABASE_URL" npm run db:wait

if [ "${SCOPELEDGER_SKIP_MIGRATIONS:-false}" != "true" ]; then
  DATABASE_URL="$MIGRATION_DATABASE_URL" npm run db:migrate
fi

DATABASE_URL="$MIGRATION_DATABASE_URL" npm run db:ensure-app-role
npm run rls:check

exec "$@"
