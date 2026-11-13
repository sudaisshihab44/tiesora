import type { FamilyEvent } from '../../types';
import { DbError, db, defined, execute, queryMany, queryOne } from './core';
import { recordAudit } from './auditLogs';
import { mapEvent, toDbDate } from './mappers';
import type { EventRow } from './rows';

export type NewEvent = Omit<
  FamilyEvent,
  'id' | 'created_at' | 'created_by'
>;

export type EventUpdates = Partial<Omit<NewEvent, 'family_id'>>;

export async function listEvents(familyId: string): Promise<FamilyEvent[]> {
  const rows = await queryMany<EventRow>(
    db()
      .from('events')
      .select('*')
      .eq('family_id', familyId)
      .order('event_date', { ascending: true }),
    'load events',
  );
  return rows.map(mapEvent);
}

export async function createEvent(
  input: NewEvent,
  actorId: string,
): Promise<FamilyEvent> {
  const eventDate = toDbDate(input.event_date);
  if (!eventDate) {
    throw new DbError('create event: a valid event date is required');
  }

  const row = {
    family_id: input.family_id,
    title: input.title.trim(),
    event_type: input.event_type,
    event_date: eventDate,
    location: input.location?.trim() || null,
    description: input.description?.trim() || null,
    associated_person_ids: input.associated_person_ids ?? [],
    created_by: actorId,
  };

  const created = await queryOne<EventRow>(
    db().from('events').insert(row).select('*').single(),
    'create event',
  );
  const event = mapEvent(created);

  await recordAudit({
    family_id: event.family_id,
    action: 'created event',
    target_type: 'event',
    target_id: event.id,
    target_name: event.title,
    details: `Scheduled "${event.title}" on ${event.event_date}.`,
  });

  return event;
}

export async function updateEvent(
  eventId: string,
  updates: EventUpdates,
): Promise<FamilyEvent> {
  let eventDate: string | null | undefined;
  if (updates.event_date !== undefined) {
    eventDate = toDbDate(updates.event_date);
    if (!eventDate) {
      throw new DbError('update event: a valid event date is required');
    }
  }

  const row = defined({
    title: updates.title?.trim(),
    event_type: updates.event_type,
    event_date: eventDate ?? undefined,
    location:
      updates.location === undefined
        ? undefined
        : updates.location.trim() || null,
    description:
      updates.description === undefined
        ? undefined
        : updates.description.trim() || null,
    associated_person_ids: updates.associated_person_ids,
  });

  if (Object.keys(row).length === 0) {
    const current = await queryOne<EventRow>(
      db().from('events').select('*').eq('id', eventId).single(),
      'load event',
    );
    return mapEvent(current);
  }

  const updated = await queryOne<EventRow>(
    db()
      .from('events')
      .update(row)
      .eq('id', eventId)
      .select('*')
      .single(),
    'update event',
  );
  const event = mapEvent(updated);

  await recordAudit({
    family_id: event.family_id,
    action: 'updated event',
    target_type: 'event',
    target_id: event.id,
    target_name: event.title,
    details: `Changed ${Object.keys(row).join(', ')}.`,
  });

  return event;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const current = await queryOne<EventRow>(
    db().from('events').select('*').eq('id', eventId).single(),
    'load event',
  );

  await execute(
    db().from('events').delete().eq('id', eventId),
    'delete event',
  );

  await recordAudit({
    family_id: current.family_id,
    action: 'deleted event',
    target_type: 'event',
    target_id: eventId,
    target_name: current.title,
    details: `Removed the event "${current.title}".`,
  });
}
