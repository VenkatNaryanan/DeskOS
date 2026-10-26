-- ==============================================================================
-- DeskOS - Backward Compatibility Views & Adapters Migration 002
-- Provides backwards compatibility for legacy endpoints & dashboards
-- ==============================================================================

-- 1. Universal Businesses View (Aggregates normalized services & faqs into JSON)
CREATE OR REPLACE VIEW public.universal_businesses AS
SELECT
    b.slug AS business_id,
    b.id AS tenant_uuid,
    b.name AS business_name,
    b.industry,
    b.client_label,
    b.provider_label,
    b.tone,
    b.currency,
    b.broadcast_notice,
    b.broadcast_notice AS emergency_notice,
    b.operating_hours,
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', s.id::text,
                    'name', s.name,
                    'price', s.price,
                    'duration', s.duration_minutes || ' mins',
                    'category', s.category
                ) ORDER BY s.created_at ASC
            )
            FROM public.services s
            WHERE s.business_id = b.id AND s.is_active = true
        ),
        '[]'::jsonb
    ) AS services,
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', f.id::text,
                    'question', f.question,
                    'answer', f.answer,
                    'category', f.category
                ) ORDER BY f.display_order ASC, f.created_at ASC
            )
            FROM public.faqs f
            WHERE f.business_id = b.id
        ),
        '[]'::jsonb
    ) AS faqs,
    b.escalation_rules,
    b.updated_at
FROM public.businesses b;

-- 2. Universal Bookings View
CREATE OR REPLACE VIEW public.universal_bookings AS
SELECT
    a.id,
    b.slug AS business_id,
    a.business_id AS tenant_uuid,
    a.conversation_id,
    a.client_name,
    a.client_name AS patient_name,
    a.phone,
    a.slot_time,
    a.service_name AS service,
    a.service_name AS service_type,
    sr.name AS provider_name,
    a.notes,
    a.status,
    a.start_time,
    a.end_time,
    a.created_at
FROM public.appointments a
JOIN public.businesses b ON a.business_id = b.id
LEFT JOIN public.staff_resources sr ON a.staff_id = sr.id;

-- 3. Legacy Bookings View
CREATE OR REPLACE VIEW public.legacy_bookings AS
SELECT
    id,
    conversation_id,
    client_name AS patient_name,
    phone,
    slot_time,
    service_name AS service,
    service_name AS service_type,
    status,
    created_at
FROM public.appointments;

-- 4. Legacy Business Configs View
CREATE OR REPLACE VIEW public.legacy_business_configs AS
SELECT
    slug AS business_id,
    name AS business_name,
    broadcast_notice AS emergency_notice,
    operating_hours,
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', s.id::text,
                    'name', s.name,
                    'price', s.price,
                    'duration', s.duration_minutes || ' mins',
                    'category', s.category
                ) ORDER BY s.created_at ASC
            )
            FROM public.services s
            WHERE s.business_id = b.id AND s.is_active = true
        ),
        '[]'::jsonb
    ) AS services,
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', f.id::text,
                    'question', f.question,
                    'answer', f.answer,
                    'category', f.category
                ) ORDER BY f.display_order ASC, f.created_at ASC
            )
            FROM public.faqs f
            WHERE f.business_id = b.id
        ),
        '[]'::jsonb
    ) AS faqs,
    updated_at
FROM public.businesses b;
