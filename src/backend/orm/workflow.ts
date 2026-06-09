import { createClient } from '@/lib/supabase/server';

export interface WarrantyClaim {
  id?: string;
  org_id: string;
  asset_id: string;
  vendor_id: string;
  ticket_id?: string;
  claim_number: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'resolved';
  issue_description?: string;
  vendor_rma_number?: string;
  submitted_at?: string;
  resolved_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Escalation {
  id?: string;
  org_id: string;
  entity_type: 'project' | 'ticket' | 'po';
  entity_id: string;
  escalated_by: string;
  assigned_to?: string;
  reason: string;
  status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'closed';
  severity: number;
  created_at?: string;
  updated_at?: string;
}

export interface ApprovalRule {
  id?: string;
  org_id: string;
  module: 'quote' | 'po' | 'expense';
  condition_sql: string;
  approver_role: string;
  is_active: boolean;
  created_at?: string;
}

export interface CommissioningReport {
  id?: string;
  org_id: string;
  project_id: string;
  commissioned_by: string;
  net_meter_number?: string;
  capacity_tested_kw?: number;
  is_approved: boolean;
  customer_signoff: boolean;
  signoff_date?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardConfig {
  id?: string;
  org_id: string;
  profile_id: string;
  dashboard_name: string;
  layout_json: any;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function createWarrantyClaim(claim: WarrantyClaim) {
  const supabase = await createClient();
  return (supabase as any).from('proc_warranty_claims').insert(claim).select().single();
}

export async function createEscalation(escalation: Escalation) {
  const supabase = await createClient();
  return (supabase as any).from('sys_escalations').insert(escalation).select().single();
}

export async function getEscalationsByEntity(entity_type: string, entity_id: string) {
  const supabase = await createClient();
  return (supabase as any).from('sys_escalations')
    .select('*')
    .eq('entity_type', entity_type)
    .eq('entity_id', entity_id);
}

export async function addCommissioningReport(report: CommissioningReport) {
  const supabase = await createClient();
  return (supabase as any).from('epc_commissioning_reports').insert(report).select().single();
}

export async function getDashboardConfig(profile_id: string, dashboard_name: string) {
  const supabase = await createClient();
  return (supabase as any).from('sys_dashboards')
    .select('*')
    .eq('profile_id', profile_id)
    .eq('dashboard_name', dashboard_name)
    .single();
}
