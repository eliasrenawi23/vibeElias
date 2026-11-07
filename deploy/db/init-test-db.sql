-- Creates the database used by the API e2e test suite (TEST_DATABASE_URL).
-- Executed by the postgres image entrypoint (via psql) only on the first initialisation of the
-- data volume. To re-run on an existing volume: docker compose down -v && docker compose up -d postgres
SELECT 'CREATE DATABASE renawi_test OWNER renawi'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'renawi_test')\gexec
