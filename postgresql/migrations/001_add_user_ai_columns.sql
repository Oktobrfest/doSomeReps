-- Add per-user AI / LiteLLM integration columns to the users table.
-- Apply this against the running PostgreSQL database, e.g.:
--   psql "$DATABASE_URL" -f 001_add_user_ai_columns.sql

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(60),
    ADD COLUMN IF NOT EXISTS ai_model    VARCHAR(120),
    ADD COLUMN IF NOT EXISTS ai_api_key  VARCHAR(500),
    ADD COLUMN IF NOT EXISTS ai_api_base VARCHAR(400);
