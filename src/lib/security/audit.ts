import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export interface AuditLogEntry {
  orgId: string;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, any>;
}

/**
 * Creates a tamper-evident audit log entry.
 * It hashes the payload along with the previous log's hash (if available)
 * to create a blockchain-like chain of logs.
 */
export async function logAuditTrail(entry: AuditLogEntry) {
  try {
    const supabase = await createClient();

    // Fetch the most recent log for this org to chain the hashes
    const { data: lastLog } = await (supabase as any)
      .from('audit_logs')
      .select('hash')
      .eq('org_id', entry.orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousHash = lastLog?.hash || '0000000000000000000000000000000000000000000000000000000000000000';
    const timestamp = new Date().toISOString();
    
    const payloadToHash = JSON.stringify({
      ...entry,
      timestamp,
      previousHash
    });

    const hash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

    const { error } = await (supabase as any).from('audit_logs').insert({
      org_id: entry.orgId,
      user_id: entry.userId,
      action: entry.action,
      resource: entry.resource,
      details: entry.details,
      previous_hash: previousHash,
      hash,
      created_at: timestamp
    });

    if (error) {
      console.error('[AuditLog] Failed to insert audit log:', error.message);
      // Depending on strictness, we might throw here or just log the error.
    }
  } catch (err) {
    console.error('[AuditLog] Exception during audit logging:', err);
  }
}
