-- ==============================================================================
-- Multilingual Voice & WhatsApp Lead Qualification Engine - Database Migration
-- Execute this script in your Supabase Project -> SQL Editor
-- ==============================================================================

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_user_id TEXT UNIQUE NOT NULL,
    current_state TEXT DEFAULT 'initial',
    is_ai_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS wa_user_id TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS current_state TEXT DEFAULT 'initial';
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS is_ai_active BOOLEAN DEFAULT true;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL, -- 'user', 'assistant', 'operator', 'system'
    content TEXT NOT NULL,
    meta_message_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS conversation_id UUID;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS sender TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS meta_message_id TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Unique index for meta_message_id to enforce idempotency when provided
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_meta_id ON public.chat_messages(meta_message_id) WHERE meta_message_id IS NOT NULL;

-- 3. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    patient_name TEXT,
    phone TEXT,
    slot_time TEXT NOT NULL,
    service TEXT,
    service_type TEXT,
    status TEXT DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS conversation_id UUID;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS patient_name TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS slot_time TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 4. Business Configurations Table (Legacy fallback)
CREATE TABLE IF NOT EXISTS public.business_configs (
    business_id TEXT PRIMARY KEY DEFAULT 'default_clinic',
    business_name TEXT NOT NULL DEFAULT 'Apex Healthcare & Dental Clinic',
    emergency_notice JSONB DEFAULT '{"is_active": false, "notice_text": "", "effective_dates": ""}'::jsonb,
    operating_hours JSONB DEFAULT '{"monday": {"is_closed": false, "open": "09:00", "close": "20:00"}, "tuesday": {"is_closed": false, "open": "09:00", "close": "20:00"}, "wednesday": {"is_closed": false, "open": "09:00", "close": "20:00"}, "thursday": {"is_closed": false, "open": "09:00", "close": "20:00"}, "friday": {"is_closed": false, "open": "09:00", "close": "20:00"}, "saturday": {"is_closed": false, "open": "10:00", "close": "18:00"}, "sunday": {"is_closed": true, "open": "10:00", "close": "14:00"}}'::jsonb,
    services JSONB DEFAULT '[]'::jsonb,
    faqs JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Universal Businesses Table (Multi-Industry SaaS Engine)
CREATE TABLE IF NOT EXISTS public.universal_businesses (
    business_id TEXT PRIMARY KEY DEFAULT 'default_business',
    business_name TEXT NOT NULL DEFAULT 'Apex Studio & AI Receptionist',
    industry TEXT DEFAULT 'healthcare',
    client_label TEXT DEFAULT 'Patient',
    provider_label TEXT DEFAULT 'Doctor',
    tone TEXT DEFAULT 'Empathetic & Clinical',
    currency TEXT DEFAULT '₹',
    broadcast_notice JSONB DEFAULT '{"is_active": false, "notice_text": "", "effective_dates": ""}'::jsonb,
    emergency_notice JSONB DEFAULT '{"is_active": false, "notice_text": "", "effective_dates": ""}'::jsonb,
    operating_hours JSONB DEFAULT '{"monday": {"is_closed": false, "open": "09:00", "close": "20:00"}, "tuesday": {"is_closed": false, "open": "09:00", "close": "20:00"}, "wednesday": {"is_closed": false, "open": "09:00", "close": "20:00"}, "thursday": {"is_closed": false, "open": "09:00", "close": "20:00"}, "friday": {"is_closed": false, "open": "09:00", "close": "20:00"}, "saturday": {"is_closed": false, "open": "10:00", "close": "18:00"}, "sunday": {"is_closed": true, "open": "10:00", "close": "14:00"}}'::jsonb,
    services JSONB DEFAULT '[]'::jsonb,
    faqs JSONB DEFAULT '[]'::jsonb,
    escalation_rules JSONB DEFAULT '["human", "manager", "complaint", "refund", "urgent", "emergency"]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Universal Bookings Table (Multi-Industry Appointments)
CREATE TABLE IF NOT EXISTS public.universal_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id TEXT DEFAULT 'default_business',
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    slot_time TEXT NOT NULL,
    service TEXT NOT NULL,
    service_type TEXT,
    provider_name TEXT,
    notes TEXT,
    status TEXT DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS & Realtime for Universal Tables
ALTER TABLE public.universal_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universal_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and auth all access to universal_businesses" ON public.universal_businesses;
CREATE POLICY "Allow anon and auth all access to universal_businesses" ON public.universal_businesses
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and auth all access to universal_bookings" ON public.universal_bookings;
CREATE POLICY "Allow anon and auth all access to universal_bookings" ON public.universal_bookings
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 5. Enable Row Level Security (RLS) & Allow Anonymous & Authenticated Full Access
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and auth all access to conversations" ON public.conversations;
CREATE POLICY "Allow anon and auth all access to conversations" ON public.conversations
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and auth all access to chat_messages" ON public.chat_messages;
CREATE POLICY "Allow anon and auth all access to chat_messages" ON public.chat_messages
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and auth all access to bookings" ON public.bookings;
CREATE POLICY "Allow anon and auth all access to bookings" ON public.bookings
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and auth all access to business_configs" ON public.business_configs;
CREATE POLICY "Allow anon and auth all access to business_configs" ON public.business_configs
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. Enable Realtime Replication for Live Support Desk
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.business_configs;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;

