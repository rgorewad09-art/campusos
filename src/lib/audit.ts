import { createClient } from '@/src/lib/supabase/server';

interface AuditLogParams {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown> | string;
}

/**
 * Server-side audit logging helper.
 * Records administrator actions in public.audit_logs.
 * Invoked strictly from trusted Server Actions — never exposed to client browsers.
 */
export async function logAuditAction({
  actorId,
  action,
  entityType,
  entityId,
  details,
}: AuditLogParams): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: typeof details === 'object' ? JSON.stringify(details) : details,
    });
  } catch (error) {
    // Non-blocking: log error to avoid interrupting the primary transaction
    console.error('[CampusOS Audit] Could not write audit log:', error);
  }
}
