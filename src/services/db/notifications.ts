import type { AppNotification } from '../../types';
import { DbError, db, execute, queryMany, queryOne } from './core';
import { mapNotification } from './mappers';
import type { NotificationRow } from './rows';

export type NewNotification = Omit<
  AppNotification,
  'id' | 'created_at' | 'is_read' | 'user_id'
>;

export async function listNotifications(
  userId: string,
): Promise<AppNotification[]> {
  const rows = await queryMany<NotificationRow>(
    db()
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    'load notifications',
  );
  return rows.map(mapNotification);
}

export async function markNotificationRead(
  notificationId: string,
): Promise<void> {
  await execute(
    db()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId),
    'mark notification read',
  );
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await execute(
    db()
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false),
    'mark all notifications read',
  );
}

/** Creates a notification for the signed-in user (RLS allows self inserts). */
export async function createNotification(
  input: NewNotification,
  userId: string,
): Promise<AppNotification> {
  const row = {
    user_id: userId,
    family_id: input.family_id,
    type: input.type,
    title: input.title,
    message: input.message,
    link_tab: input.link_tab ?? null,
    link_id: input.link_id ?? null,
    is_read: false,
  };

  const created = await queryOne<NotificationRow>(
    db().from('notifications').insert(row).select('*').single(),
    'create notification',
  );
  return mapNotification(created);
}

/**
 * Notifies every active admin of a family except the caller. Runs through the
 * SECURITY DEFINER RPC so a viewer can notify admins without being able to
 * insert notifications for arbitrary users.
 */
export async function notifyFamilyAdmins(
  familyId: string,
  type: AppNotification['type'],
  title: string,
  message: string,
  linkTab?: string,
  linkId?: string,
): Promise<void> {
  const { error } = await db().rpc('notify_family_admins', {
    p_family_id: familyId,
    p_type: type,
    p_title: title,
    p_message: message,
    p_link_tab: linkTab ?? null,
    p_link_id: linkId ?? null,
  });

  if (error) throw new DbError('notify family admins', error);
}
