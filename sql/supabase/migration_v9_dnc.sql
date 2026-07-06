-- Migration v9: Create Do Not Call registry table
CREATE TABLE IF NOT EXISTS do_not_call (
    phone_number TEXT PRIMARY KEY,
    created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    reason       TEXT
);

-- Enable RLS and expose all permissions to anon/service role
ALTER TABLE do_not_call ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all do_not_call" ON do_not_call;
CREATE POLICY "Allow anon all do_not_call"
    ON do_not_call FOR ALL TO anon USING (true) WITH CHECK (true);
