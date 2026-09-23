#!/bin/sh
set -e

echo "waiting for postgres at $PGHOST:$PGPORT..."
until node -e "
  const { Client } = require('pg');
  const c = new Client({ host: process.env.PGHOST, port: process.env.PGPORT, user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE });
  c.connect().then(() => c.end()).catch(() => process.exit(1));
"; do
  sleep 1
done

echo "running migrations"
node db/migrate.js

if [ "$SEED_ON_START" = "true" ]; then
  echo "seeding database"
  node db/seed.js || echo "seed skipped (probably already seeded)"
fi

exec "$@"
