import type { RealtimeChannel } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';

/**
 * Tables whose changes should refresh the open family workspace.
 * `families` filters on its primary key; the rest filter on `family_id`.
 */
const FAMILY_TABLES = [
  'families',
  'family_people',
  'relationships',
  'memories',
  'events',
  'family_memberships',
  'invitations',
  'change_requests',
  'audit_logs',
] as const;

/**
 * Subscribes to Postgres changes for one family.
 *
 * Bursts (for example a bulk import or several rapid edits) are collapsed into
 * a single refresh so the UI does not reload the whole tree per row.
 *
 * Returns an unsubscribe function. Safe to call in demo mode — it becomes a
 * no-op when Supabase is not configured.
 */
export function subscribeToFamilyChanges(
  familyId: string,
  onChange: () => void,
): () => void {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const client = supabase;

  let timer: ReturnType<typeof setTimeout> | null = null;
  const scheduleRefresh = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, 1200);
  };

  let channel: RealtimeChannel = client.channel(`family:${familyId}`);

  for (const table of FAMILY_TABLES) {
    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter:
          table === 'families'
            ? `id=eq.${familyId}`
            : `family_id=eq.${familyId}`,
      },
      scheduleRefresh,
    );
  }

  channel.subscribe((status, error) => {
    if (import.meta.env.DEV) {
      console.info(`[realtime] ${status} for family ${familyId}`, error ?? '');
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn(`[realtime] ${status} for family ${familyId}`, error ?? '');
    }
  });

  return () => {
    if (timer) clearTimeout(timer);
    void client.removeChannel(channel);
  };
}
