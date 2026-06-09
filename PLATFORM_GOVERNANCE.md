# ENERMASS ERP - PLATFORM GOVERNANCE

This document outlines the design and integration of the ENERMASS ERP Platform Governance Layer. It describes the overarching principles and concrete schemas applied to handle RBAC, Approvals, Notifications, Events, and Audit Logging uniformly across all multi-tenant applications.

---

## 1. Role-Based Access Control (RBAC) Architecture

The ENERMASS RBAC architecture separates *capabilities* (Permissions) from *identities* (Roles), ensuring deep modularity and cross-tenant reusability. 

### Core Concepts:
- **`sys_permissions`**: Global definitions of every distinct capability. 
  - *Feature Level*: E.g., `inventory.view`, `procurement.create`
  - *Action Level*: E.g., `approve_po`, `approve_vendor`
  - *Field Level*: E.g., `view_cost_price`, `edit_margin`
- **`sys_roles`**: Organization-specific roles that group multiple permissions (e.g., `Owner`, `Finance Manager`, `Technician`). Supports hierarchy tracking (1 = Highest, 10 = Standard) allowing for robust escalation workflows.
- **`sys_role_permissions`**: Pivot table binding permissions to roles.
- **`sys_user_roles`**: Pivot table binding roles to users (`profiles`). 
  - **Temporal Permissions**: Supports `valid_from` and `valid_to` bounds allowing temporary access (e.g., covering for an employee on leave).

---

## 2. Reusable Approval Engine

Instead of hard-coding SQL status updates, business modules trigger the Governance Approval Engine.

- **`sys_approval_workflows`**: Defines the workflow container (e.g., `Quote Discount > 5%`).
- **`sys_approval_workflow_rules`**: A structured rule engine (`field_name`, `operator`, `target_value`) dictating if an entity instance necessitates this workflow.
- **`sys_approval_steps`**: The sequence. Supports both `sequential` and `parallel` (`step_type`) and determines how many individuals with the `required_role_id` must approve (`required_approvals_count`) before advancing.
- **`sys_approval_requests` & `sys_approval_history`**: Maintains real-time tracking of pending approvals and their respective immutable histories.

---

## 3. Notification Engine

Provides multi-channel delivery decoupled from business logic.

- **`sys_notification_templates`**: Organization-specific templates linked to event types supporting parameters. Supports channels: `in_app`, `email`, `whatsapp`, `sms`, `push`.
- **`sys_notification_queue`**: Acts as an asynchronous buffer and delivery log. Records `status` (`queued`, `sent`, `failed`, `read`), `retry_count`, and the originating `event_payload`.

---

## 4. Event Framework

An internal pub/sub representation ensuring decoupling of consequences.

- **`sys_event_bus`**: The central table for publishing internal occurrences (e.g., `po.approved`, `inventory.low_stock`). 
- Listeners (Background CRON or DB Webhooks) consume these records and trigger subsequent Governance responses: Creating Notifications, generating Audits, or launching Approvals.

---

## 5. Audit Framework

A central nexus tracking every business-critical action.

- **`sys_audit_logs`**: Captures Who (`actor_id`), When (`created_at`), What (`action`, `module`), Before (`before_state`), and After (`after_state`). 
- **Immutability**: Protected natively via Database Triggers that explicitly block `UPDATE` and `DELETE` commands. This log acts as an unquestionable source of truth.

---

## 6. Security Review & Mitigations

### 1. Privilege Escalation Prevention
No user can arbitrarily grant themselves roles. Assignment actions are audited. `sys_roles.hierarchy_level` dictates that Role A can only manage Role B if Role A is higher in the hierarchy.

### 2. Strict Tenant Isolation (Cross-Tenant Risks)
Row Level Security (RLS) is strictly enforced using `org_id = auth_org_id()` across all governance tables (`sys_roles`, `sys_user_roles`, `sys_approval_workflows`, `sys_audit_logs`, etc.). A compromised user context is entirely isolated to their specific tenant.

### 3. Approval Bypass
Approvals enforce state transitions. A Quote cannot advance from `pending_approval` to `sent` unless a verified `sys_approval_history` record exists resolving the associated `sys_approval_requests`.

### 4. Audit Gaps
The `sys_audit_logs` immutability trigger blocks SQL-level alterations. Even administrators cannot erase their own actions.

---

## 7. ERP Integration Matrix

The table below describes how specific modules integrate with the Platform Governance layer:

| Module / Action | Required Permissions | Triggered Event | Required Approval Workflow | Notification Target | Audit Logged? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Quote Creation** | `quotes.create` | `quote.created` | None | None | Yes |
| **Quote Discount** | `quotes.edit` | `quote.discount_requested`| `Discount > 5%` (Seq) | Sales Mgr (`in_app`) | Yes |
| **Vendor Onboarding** | `vendors.create` | `vendor.created` | `Vendor Approval` | Proc. Mgr (`email`) | Yes |
| **PO Issuance** | `procurement.create` | `po.created` | `PO > ₹100k` (Multi) | Finance + Proc Mgr | Yes |
| **Inv. Adjustment** | `inventory.edit` | `inventory.adjusted` | `Adjustment Approval` | Warehouse Mgr | Yes |
| **Project Survey** | `surveys.view` | `survey.assigned` | None | Surveyor (`whatsapp`) | No |
| **Warranty Claim** | `claims.create` | `warranty.claim_created`| `Claim Authorization` | Proc. Mgr | Yes |
| **AMC Renewal** | `amc.view` | `amc.renewal_due` | None | Customer (`email`) | No |
