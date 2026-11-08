-- Emails are stored lowercased and trimmed, so the existing unique index on
-- users.email also rejects case-only duplicates. Prisma cannot declare this
-- CHECK; `db push` leaves it in place. Run with `npm run db:constraints`.
--
-- Before running on a database with older rows, look for case-only twins:
--   SELECT lower(btrim(email)), count(*) FROM users GROUP BY 1 HAVING count(*) > 1;
-- Resolve any by hand first; the guard below aborts before touching a row.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users GROUP BY lower(btrim(email)) HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'users has case-only duplicate emails; resolve them before running this migration';
    END IF;
END $$;

UPDATE users SET email = lower(btrim(email)) WHERE email <> lower(btrim(email));

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_lowercase') THEN
        ALTER TABLE users ADD CONSTRAINT users_email_lowercase CHECK (email = lower(btrim(email)));
    END IF;
END $$;
