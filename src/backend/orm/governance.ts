import { createClient } from '@/lib/supabase/server';

// ------------------------------------------------------------------
// TYPES
// ------------------------------------------------------------------

export type PermissionType = 'feature' | 'action' | 'field';
export type ApprovalStepType = 'sequential' | 'parallel';
export type ApprovalReqStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled' | 'escalated';
export type NotifChannel = 'in_app' | 'email' | 'whatsapp' | 'sms' | 'push';
export type EventStatus = 'pending' | 'processed' | 'failed';

export interface SysPermission {
  id: string;
  code: string;
  type: PermissionType;
  description?: string;
}

export interface SysRole {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  is_system_default: boolean;
  hierarchy_level: number;
}

export interface SysUserRole {
  id: string;
  org_id: string;
  profile_id: string;
  role_id: string;
  valid_from?: string;
  valid_to?: string;
}

export interface SysApprovalWorkflow {
  id: string;
  org_id: string;
  entity_type: string;
  name: string;
  is_active: boolean;
}

export interface SysApprovalRequest {
  id: string;
  org_id: string;
  workflow_id: string;
  entity_type: string;
  entity_id: string;
  status: ApprovalReqStatus;
  current_step_order: number;
  requested_by: string;
}

export interface SysAuditLog {
  id?: string;
  org_id: string;
  module: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string;
  before_state?: any;
  after_state?: any;
  ip_address?: string;
  user_agent?: string;
}

export interface SysEventBus {
  id?: string;
  org_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: any;
  triggered_by?: string;
  status?: EventStatus;
}

export interface SysNotificationQueue {
  id?: string;
  org_id: string;
  recipient_id: string;
  channel: NotifChannel;
  subject?: string;
  body: string;
  status?: 'queued' | 'sent' | 'failed' | 'read';
  event_payload?: any;
}

// ------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------

export async function hasPermission(profileId: string, permissionCode: string): Promise<boolean> {
  const supabase = await createClient();
  
  // Checking active roles for the user that have the requested permission mapped.
  // Complex query resolving User -> Role -> Permission mapping where date is valid.
  const { data, error } = await (supabase as any)
    .from('sys_user_roles')
    .select(`
      role_id,
      sys_roles!inner (
        id,
        sys_role_permissions!inner (
          sys_permissions!inner (
            code
          )
        )
      )
    `)
    .eq('profile_id', profileId)
    .eq('sys_roles.sys_role_permissions.sys_permissions.code', permissionCode)
    .or(`valid_to.is.null,valid_to.gte.${new Date().toISOString()}`)
    .or(`valid_from.is.null,valid_from.lte.${new Date().toISOString()}`);

  if (error || !data || data.length === 0) return false;
  return true;
}

export async function logAuditEvent(audit: SysAuditLog) {
  const supabase = await createClient();
  return (supabase as any).from('sys_audit_logs').insert(audit);
}

export async function publishEvent(event: SysEventBus) {
  const supabase = await createClient();
  return (supabase as any).from('sys_event_bus').insert(event);
}

export async function queueNotification(notification: SysNotificationQueue) {
  const supabase = await createClient();
  return (supabase as any).from('sys_notification_queue').insert(notification);
}

export async function submitApprovalRequest(request: Partial<SysApprovalRequest>) {
  const supabase = await createClient();
  return (supabase as any).from('sys_approval_requests').insert(request).select().maybeSingle();
}
