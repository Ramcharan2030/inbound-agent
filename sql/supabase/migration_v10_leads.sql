-- Migration v10: Create structured leads table for lead capture tool
CREATE TABLE IF NOT EXISTS leads (
    id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number  TEXT        NOT NULL,
    caller_name   TEXT,
    interest_level TEXT       NOT NULL DEFAULT 'warm',  -- hot | warm | cold
    property_interest TEXT,
    budget        TEXT,
    location_pref TEXT,
    unit_type     TEXT,
    purpose       TEXT,        -- buying | renting | investment
    notes         TEXT,
    call_room_id  TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS leads_phone_idx ON leads (phone_number);
CREATE INDEX IF NOT EXISTS leads_interest_idx ON leads (interest_level);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all leads" ON leads;
CREATE POLICY "Allow anon all leads"
    ON leads FOR ALL TO anon USING (true) WITH CHECK (true);
