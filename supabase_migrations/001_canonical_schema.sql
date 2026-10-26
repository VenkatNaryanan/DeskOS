-- ==============================================================================
-- DeskOS - Canonical Multi-Tenant Relational Schema & Migration 001
-- ==============================================================================

-- 0. Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ==============================================================================
-- 1. Businesses Table (Tenants)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    industry TEXT NOT NULL DEFAULT 'general',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    currency TEXT NOT NULL DEFAULT '₹',
    client_label TEXT NOT NULL DEFAULT 'Client',
    provider_label TEXT NOT NULL DEFAULT 'Specialist',
    tone TEXT NOT NULL DEFAULT 'Friendly, efficient, and professional',
    whatsapp_phone_number_id TEXT UNIQUE,
    whatsapp_display_number TEXT,
    broadcast_notice JSONB DEFAULT '{"is_active": false, "notice_text": "", "effective_dates": ""}'::jsonb,
    operating_hours JSONB DEFAULT '{
        "monday": {"is_closed": false, "open": "09:00", "close": "20:00"},
        "tuesday": {"is_closed": false, "open": "09:00", "close": "20:00"},
        "wednesday": {"is_closed": false, "open": "09:00", "close": "20:00"},
        "thursday": {"is_closed": false, "open": "09:00", "close": "20:00"},
        "friday": {"is_closed": false, "open": "09:00", "close": "20:00"},
        "saturday": {"is_closed": false, "open": "10:00", "close": "18:00"},
        "sunday": {"is_closed": true, "open": "10:00", "close": "14:00"}
    }'::jsonb,
    escalation_rules JSONB DEFAULT '["human", "manager", "complaint", "refund", "emergency", "urgent"]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_businesses_slug ON public.businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_wa_phone_id ON public.businesses(whatsapp_phone_number_id);

-- ==============================================================================
-- 2. Business Memberships (Multi-Tenant User Roles: owner, manager, staff)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.business_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- references auth.users(id) in Supabase Auth
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(business_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.business_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_business ON public.business_memberships(business_id);

-- ==============================================================================
-- 3. Staff Resources (Stylists, Doctors, Specialists, Technicians)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.staff_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    working_hours JSONB, -- Optional custom schedule override
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_staff_business UNIQUE (business_id, id)
);

CREATE INDEX IF NOT EXISTS idx_staff_business ON public.staff_resources(business_id);

-- ==============================================================================
-- 4. Services Catalog
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    buffer_minutes INT NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0),
    category TEXT DEFAULT 'General',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_services_business UNIQUE (business_id, id)
);

CREATE INDEX IF NOT EXISTS idx_services_business ON public.services(business_id);

-- ==============================================================================
-- 5. FAQs & Knowledge Base
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faqs_business ON public.faqs(business_id);

-- ==============================================================================
-- 6. Customers
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    name TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(business_id, phone),
    CONSTRAINT uq_customers_business UNIQUE (business_id, id)
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(business_id, phone);

-- ==============================================================================
-- 7. Conversations
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    wa_user_id TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    current_state TEXT DEFAULT 'initial',
    is_ai_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(business_id, wa_user_id),
    CONSTRAINT uq_conversations_business UNIQUE (business_id, id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_business_wa ON public.conversations(business_id, wa_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON public.conversations(updated_at DESC);

-- ==============================================================================
-- 8. Chat Messages
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant', 'operator', 'system')),
    content TEXT NOT NULL,
    meta_message_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON public.chat_messages(conversation_id, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_meta_id ON public.chat_messages(meta_message_id) WHERE meta_message_id IS NOT NULL;

-- ==============================================================================
-- 9. Appointments (Double-Booking Protected via GiST Exclusion Constraints)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE RESTRICT,
    service_name TEXT NOT NULL,
    staff_id UUID REFERENCES public.staff_resources(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    slot_time TEXT NOT NULL, -- Human-readable presentation
    time_slot_range TSTZRANGE GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('hold', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show')),
    hold_expires_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_appointments_business_status ON public.appointments(business_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_start ON public.appointments(business_id, start_time);

-- 9a. Exclusion Constraint for Assigned Staff (Prevents same staff member double-booking)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'exclude_staff_overlapping_appointments'
    ) THEN
        ALTER TABLE public.appointments
        ADD CONSTRAINT exclude_staff_overlapping_appointments
        EXCLUDE USING gist (
            business_id WITH =,
            staff_id WITH =,
            time_slot_range WITH &&
        )
        WHERE (status IN ('confirmed', 'in_progress', 'hold') AND staff_id IS NOT NULL);
    END IF;
END $$;

-- 9b. Exclusion Constraint for Pooled Single Resource (When staff_id is NULL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'exclude_pooled_overlapping_appointments'
    ) THEN
        ALTER TABLE public.appointments
        ADD CONSTRAINT exclude_pooled_overlapping_appointments
        EXCLUDE USING gist (
            business_id WITH =,
            time_slot_range WITH &&
        )
        WHERE (status IN ('confirmed', 'in_progress', 'hold') AND staff_id IS NULL);
    END IF;
END $$;

-- ==============================================================================
-- 10. Message Jobs (Durable Queue for WhatsApp Reminders and Confirmations)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.message_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    job_type TEXT NOT NULL CHECK (job_type IN ('booking_confirmation', 'reminder_24h', 'reminder_2h', 'cancellation_notice', 'custom')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    last_attempt_at TIMESTAMPTZ,
    error_message TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_jobs_dispatch ON public.message_jobs(status, scheduled_at) WHERE status IN ('pending', 'processing');

-- ==============================================================================
-- 11. Analytics & Audit Events (True Persisted Metrics)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    entity_id TEXT,
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_business_type ON public.analytics_events(business_id, event_type, created_at DESC);

-- ==============================================================================
-- 12. Seed Default Business & Initial Demo Setup
-- ==============================================================================
INSERT INTO public.businesses (
    id,
    slug,
    name,
    industry,
    timezone,
    currency,
    client_label,
    provider_label,
    tone,
    operating_hours,
    broadcast_notice
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'default-business',
    'Apex Healthcare & Dental Clinic',
    'healthcare',
    'Asia/Kolkata',
    '₹',
    'Patient',
    'Doctor',
    'Empathetic, clinical, reassuring, precise',
    '{
        "monday": {"is_closed": false, "open": "09:00", "close": "20:00"},
        "tuesday": {"is_closed": false, "open": "09:00", "close": "20:00"},
        "wednesday": {"is_closed": false, "open": "09:00", "close": "20:00"},
        "thursday": {"is_closed": false, "open": "09:00", "close": "20:00"},
        "friday": {"is_closed": false, "open": "09:00", "close": "20:00"},
        "saturday": {"is_closed": false, "open": "10:00", "close": "18:00"},
        "sunday": {"is_closed": true, "open": "10:00", "close": "14:00"}
    }'::jsonb,
    '{"is_active": false, "notice_text": "", "effective_dates": ""}'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- Seed default services
INSERT INTO public.services (business_id, name, description, price, duration_minutes, category)
SELECT 
    '00000000-0000-0000-0000-000000000001',
    s.name,
    s.description,
    s.price,
    s.duration_minutes,
    s.category
FROM (VALUES
    ('Dental Consultation & Exam', 'Comprehensive oral inspection and treatment planning', 500.00, 30, 'General'),
    ('Teeth Cleaning & Scaling', 'Ultrasonic tartar removal and polish', 1500.00, 45, 'Preventive'),
    ('Root Canal Treatment (RCT)', 'Complete single or multi-session root canal therapy', 4500.00, 60, 'Endodontics'),
    ('Teeth Whitening', 'Professional LED laser whitening session', 6000.00, 45, 'Cosmetic'),
    ('Dental Crown / Cap', 'Custom ceramic zirconium tooth crown fitment', 3500.00, 45, 'Prosthodontics')
) AS s(name, description, price, duration_minutes, category)
WHERE NOT EXISTS (
    SELECT 1 FROM public.services WHERE business_id = '00000000-0000-0000-0000-000000000001'
);

-- Seed default staff
INSERT INTO public.staff_resources (business_id, name, role, email, phone)
SELECT 
    '00000000-0000-0000-0000-000000000001',
    st.name,
    st.role,
    st.email,
    st.phone
FROM (VALUES
    ('Dr. Sarah Khan', 'Senior Endodontist', 'sarah.khan@apexclinic.com', '+919876543201'),
    ('Dr. Arjun Patel', 'Cosmetic Dental Surgeon', 'arjun.patel@apexclinic.com', '+919876543202')
) AS st(name, role, email, phone)
WHERE NOT EXISTS (
    SELECT 1 FROM public.staff_resources WHERE business_id = '00000000-0000-0000-0000-000000000001'
);

-- Seed default FAQs
INSERT INTO public.faqs (business_id, question, answer, category, display_order)
SELECT
    '00000000-0000-0000-0000-000000000001',
    f.question,
    f.answer,
    f.category,
    f.display_order
FROM (VALUES
    ('Where is Apex Dental Clinic located?', 'We are situated at 12th Floor, Green Tower, MG Road, Bengaluru, Karnataka.', 'Location', 1),
    ('What payment modes do you accept?', 'We accept UPI (Google Pay, PhonePe, Paytm), Visa/Mastercard credit/debit cards, and cash.', 'Billing', 2),
    ('What should I do in case of acute toothache emergency?', 'Please call our emergency helpline at +91 98765 43210 or visit our urgent-care room during open hours.', 'Emergency', 3)
) AS f(question, answer, category, display_order)
WHERE NOT EXISTS (
    SELECT 1 FROM public.faqs WHERE business_id = '00000000-0000-0000-0000-000000000001'
);

-- ==============================================================================
-- 13. Row Level Security (RLS) Policies
-- ==============================================================================
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Public read-only policy for active businesses, services, and faqs (for booking page / public catalog)
DROP POLICY IF EXISTS "Public can view active businesses" ON public.businesses;
CREATE POLICY "Public can view active businesses" ON public.businesses
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can view active services" ON public.services;
CREATE POLICY "Public can view active services" ON public.services
    FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public can view active staff" ON public.staff_resources;
CREATE POLICY "Public can view active staff" ON public.staff_resources
    FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public can view faqs" ON public.faqs;
CREATE POLICY "Public can view faqs" ON public.faqs
    FOR SELECT TO anon, authenticated USING (true);

-- Authenticated members policy: access based on business_memberships
DROP POLICY IF EXISTS "Members can view their business data" ON public.businesses;
CREATE POLICY "Members can view their business data" ON public.businesses
    FOR ALL TO authenticated
    USING (
        id IN (SELECT business_id FROM public.business_memberships WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Members can manage services" ON public.services;
CREATE POLICY "Members can manage services" ON public.services
    FOR ALL TO authenticated
    USING (
        business_id IN (SELECT business_id FROM public.business_memberships WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Members can manage staff" ON public.staff_resources;
CREATE POLICY "Members can manage staff" ON public.staff_resources
    FOR ALL TO authenticated
    USING (
        business_id IN (SELECT business_id FROM public.business_memberships WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Members can view appointments" ON public.appointments;
CREATE POLICY "Members can view appointments" ON public.appointments
    FOR ALL TO authenticated
    USING (
        business_id IN (SELECT business_id FROM public.business_memberships WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
CREATE POLICY "Members can view conversations" ON public.conversations
    FOR ALL TO authenticated
    USING (
        business_id IN (SELECT business_id FROM public.business_memberships WHERE user_id = auth.uid())
    );

-- Service Role Key retains full bypass access for backend server execution
-- ==============================================================================
