-- ==============================================================================
-- ENERMASS ERP - PLATFORM GOVERNANCE LAYER
-- Handles: RBAC, Approvals, Events, Notifications, and Audit Logging
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- PHASE 1 & 2: ENUMS & TYPES
-- ──────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN CREATE TYPE permission_type AS ENUM ('feature', 'action', 'field'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE approval_step_type AS ENUM ('sequential', 'parallel'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE approval_req_status AS ENUM ('pending', 'in_progress', 'approved', 'rejected', 'cancelled', 'escalated'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE notif_channel AS ENUM ('in_app', 'email', 'whatsapp', 'sms', 'push'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE notif_status AS ENUM ('queued', 'sent', 'failed', 'read'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE event_status AS ENUM ('pending', 'processed', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE operator_type AS ENUM ('eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains'); EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ──────────────────────────────────────────────────────────────────────────────
-- PHASE 1 & 2: ROLE BASED ACCESS CONTROL (RBAC) & PERMISSIONS
-- ──────────────────────────────────────────────────────────────────────────────

-- Global permissions dictionary (Not tenant-specific, defines what the app CAN do)
CREATE TABLE IF NOT EXISTS sys_permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT UNIQUE NOT NULL, -- e.g., 'inventory.view', 'approve_po'
    type            permission_type NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization Roles
CREATE TABLE IF NOT EXISTS sys_roles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    description       TEXT,
    is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
    hierarchy_level   INTEGER NOT NULL DEFAULT 10, -- 1 = Highest (Owner), 10 = Standard
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, name)
);

-- Mapping Roles to Permissions
CREATE TABLE IF NOT EXISTS sys_role_permissions (
    role_id         UUID NOT NULL REFERENCES sys_roles(id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES sys_permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- User Role Assignments (Supports temporary permissions)
CREATE TABLE IF NOT EXISTS sys_user_roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role_id         UUID NOT NULL REFERENCES sys_roles(id) ON DELETE CASCADE,
    valid_from      TIMESTAMPTZ,
    valid_to        TIMESTAMPTZ, -- If NULL, permanent
    assigned_by     UUID REFERENCES profiles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────────────────────────
-- PHASE 3: APPROVAL ENGINE (Structured, reusable)
-- ──────────────────────────────────────────────────────────────────────────────

-- Defines an approval workflow for a specific entity type
CREATE TABLE IF NOT EXISTS sys_approval_workflows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    entity_type     TEXT NOT NULL, -- 'quote', 'purchase_order', 'vendor'
    name            TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Structured rules defining WHEN this workflow triggers
CREATE TABLE IF NOT EXISTS sys_approval_workflow_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     UUID NOT NULL REFERENCES sys_approval_workflows(id) ON DELETE CASCADE,
    field_name      TEXT NOT NULL, -- e.g., 'discount_percentage', 'total_amount'
    operator        operator_type NOT NULL,
    target_value    JSONB NOT NULL -- Stored as JSONB to support numbers, strings, arrays
);

-- The sequence of steps for a workflow
CREATE TABLE IF NOT EXISTS sys_approval_steps (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id              UUID NOT NULL REFERENCES sys_approval_workflows(id) ON DELETE CASCADE,
    step_order               INTEGER NOT NULL,
    step_type                approval_step_type NOT NULL DEFAULT 'sequential',
    required_role_id         UUID REFERENCES sys_roles(id), -- Who can approve
    required_approvals_count INTEGER NOT NULL DEFAULT 1,    -- How many approvals needed for this step
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Live instances of workflows triggered by events
CREATE TABLE IF NOT EXISTS sys_approval_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    workflow_id         UUID NOT NULL REFERENCES sys_approval_workflows(id),
    entity_type         TEXT NOT NULL,
    entity_id           UUID NOT NULL,
    status              approval_req_status NOT NULL DEFAULT 'pending',
    current_step_order  INTEGER NOT NULL DEFAULT 1,
    requested_by        UUID NOT NULL REFERENCES profiles(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable audit log of approval actions
CREATE TABLE IF NOT EXISTS sys_approval_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id          UUID NOT NULL REFERENCES sys_approval_requests(id) ON DELETE CASCADE,
    step_id             UUID NOT NULL REFERENCES sys_approval_steps(id),
    approver_id         UUID NOT NULL REFERENCES profiles(id),
    action              TEXT NOT NULL, -- 'approved', 'rejected', 'escalated'
    comments            TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ──────────────────────────────────────────────────────────────────────────────
-- PHASE 4: NOTIFICATION ENGINE
-- ──────────────────────────────────────────────────────────────────────────────

-- Templates for generating notifications
CREATE TABLE IF NOT EXISTS sys_notification_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL, -- e.g., 'quote.approved'
    channel         notif_channel NOT NULL,
    subject_template TEXT,
    body_template    TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Queue and delivery log for notifications
CREATE TABLE IF NOT EXISTS sys_notification_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    recipient_id    UUID NOT NULL REFERENCES profiles(id),
    channel         notif_channel NOT NULL,
    subject         TEXT,
    body            TEXT NOT NULL,
    status          notif_status NOT NULL DEFAULT 'queued',
    retry_count     INTEGER NOT NULL DEFAULT 0,
    event_payload   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ
);


-- ──────────────────────────────────────────────────────────────────────────────
-- PHASE 5: EVENT FRAMEWORK
-- ──────────────────────────────────────────────────────────────────────────────

-- Centralized event bus for the entire ERP
CREATE TABLE IF NOT EXISTS sys_event_bus (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL, -- e.g., 'po.approved', 'inventory.low_stock'
    entity_type     TEXT NOT NULL,
    entity_id       UUID NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    triggered_by    UUID REFERENCES profiles(id),
    status          event_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);


-- ──────────────────────────────────────────────────────────────────────────────
-- PHASE 6: AUDIT FRAMEWORK (Immutable)
-- ──────────────────────────────────────────────────────────────────────────────

-- Centralized, tamper-proof audit logging
CREATE TABLE IF NOT EXISTS sys_audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    module          TEXT NOT NULL, -- 'inventory', 'finance', 'quotes'
    entity_type     TEXT NOT NULL,
    entity_id       UUID NOT NULL,
    action          TEXT NOT NULL, -- 'create', 'update', 'delete', 'approve'
    actor_id        UUID REFERENCES profiles(id),
    before_state    JSONB,
    after_state     JSONB,
    ip_address      TEXT,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- To ensure immutability at the DB level, we can revoke UPDATE and DELETE
-- on sys_audit_logs later via RLS, or use a trigger to prevent edits.
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_immutability_update ON sys_audit_logs;
CREATE TRIGGER audit_log_immutability_update
    BEFORE UPDATE ON sys_audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

DROP TRIGGER IF EXISTS audit_log_immutability_delete ON sys_audit_logs;
CREATE TRIGGER audit_log_immutability_delete
    BEFORE DELETE ON sys_audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();


-- ──────────────────────────────────────────────────────────────────────────────
-- PHASE 7: ROW LEVEL SECURITY (RLS) ENFORCEMENT
-- ──────────────────────────────────────────────────────────────────────────────

-- Enable RLS
ALTER TABLE sys_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_approval_workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_event_bus ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_audit_logs ENABLE ROW LEVEL SECURITY;

-- Note: sys_permissions and sys_role_permissions might be global or tenant-scoped. 
-- In our schema, sys_permissions is global (no org_id). sys_role_permissions inherits RLS via role_id.
ALTER TABLE sys_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "global_read_sys_permissions" ON sys_permissions FOR SELECT USING (TRUE);

-- Tenant Isolation Policies
CREATE POLICY "sys_roles_org_isolation" ON sys_roles FOR ALL USING (org_id = auth_org_id());
CREATE POLICY "sys_user_roles_org_isolation" ON sys_user_roles FOR ALL USING (org_id = auth_org_id());

CREATE POLICY "sys_approval_workflows_org_isolation" ON sys_approval_workflows FOR ALL USING (org_id = auth_org_id());
-- Step and Rule isolation implicit via workflow_id, but good practice to link org_id natively. 
-- For simplicity, we ensure apps select via workflow.

CREATE POLICY "sys_approval_requests_org_isolation" ON sys_approval_requests FOR ALL USING (org_id = auth_org_id());
-- sys_approval_history isolates via request_id

CREATE POLICY "sys_notification_templates_org_isolation" ON sys_notification_templates FOR ALL USING (org_id = auth_org_id());
CREATE POLICY "sys_notification_queue_org_isolation" ON sys_notification_queue FOR ALL USING (org_id = auth_org_id());
CREATE POLICY "sys_event_bus_org_isolation" ON sys_event_bus FOR ALL USING (org_id = auth_org_id());
CREATE POLICY "sys_audit_logs_org_isolation" ON sys_audit_logs FOR ALL USING (org_id = auth_org_id());
