import type { ChangeRequest } from '../../types';
import { db, queryMany, queryOne } from './core';
import { recordAudit } from './auditLogs';
import { mapChangeRequest } from './mappers';
import type { ChangeRequestRow } from './rows';
import { notifyFamilyAdmins } from './notifications';
import { updatePerson, createPerson, type PersonUpdates } from './people';

export type NewChangeRequest = Omit<
  ChangeRequest,
  'id' | 'created_at' | 'status' | 'requested_by' | 'requested_by_name'
>;

export async function listChangeRequests(
  familyId: string,
): Promise<ChangeRequest[]> {
  const rows = await queryMany<ChangeRequestRow>(
    db()
      .from('change_requests')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false }),
    'load change requests',
  );
  return rows.map(mapChangeRequest);
}

export async function getChangeRequest(
  changeRequestId: string,
): Promise<ChangeRequest> {
  const row = await queryOne<ChangeRequestRow>(
    db()
      .from('change_requests')
      .select('*')
      .eq('id', changeRequestId)
      .single(),
    'load change request',
  );
  return mapChangeRequest(row);
}

export async function submitChangeRequest(
  input: NewChangeRequest,
  actor: { id: string; display_name: string },
): Promise<ChangeRequest> {
  const row = {
    family_id: input.family_id,
    person_id: input.person_id ?? null,
    requested_by: actor.id,
    requested_by_name: actor.display_name,
    change_type: input.change_type,
    payload: input.payload,
    status: 'pending',
  };

  const created = await queryOne<ChangeRequestRow>(
    db().from('change_requests').insert(row).select('*').single(),
    'submit change request',
  );
  const changeRequest = mapChangeRequest(created);

  await recordAudit({
    family_id: changeRequest.family_id,
    action: 'submitted change request',
    target_type: 'change_request',
    target_id: changeRequest.id,
    target_name: changeRequest.change_type.replace(/_/g, ' '),
    details: `${actor.display_name} suggested a change to family records.`,
  });

  // Best-effort notification for admins. A notification failure must not
  // discard a successfully submitted change request.
  try {
    await notifyFamilyAdmins(
      input.family_id,
      'change_request_submitted',
      'New Edit Suggestion',
      `${actor.display_name} suggested a change to family records.`,
      'collaboration',
    );
  } catch (error) {
    console.warn('[db] change request saved, admin notification failed:', error);
  }

  return changeRequest;
}

const PERSON_UPDATE_FIELDS = [
  'full_name',
  'display_name',
  'gender',
  'birth_date',
  'birth_place',
  'death_date',
  'death_place',
  'date_precision',
  'living_status',
  'biography',
  'avatar_path',
  'generation_level',
  'branch',
] as const;

export async function reviewChangeRequest(
  changeRequestId: string,
  decision: 'approved' | 'rejected',
  reviewNote: string | undefined,
  reviewer: { id: string; display_name: string },
): Promise<ChangeRequest> {
  const current = await getChangeRequest(changeRequestId);

  const updated = await queryOne<ChangeRequestRow>(
    db()
      .from('change_requests')
      .update({
        status: decision,
        reviewed_by: reviewer.id,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote?.trim() || null,
      })
      .eq('id', changeRequestId)
      .select('*')
      .single(),
    'review change request',
  );

  if (decision === 'approved') {
    const payload =
      current.payload && typeof current.payload === 'object'
        ? (current.payload as Record<string, unknown>)
        : {};
    if (current.person_id && current.change_type === 'edit_person') {
      const updates = Object.fromEntries(
        Object.entries(payload).filter(([key]) =>
          (PERSON_UPDATE_FIELDS as readonly string[]).includes(key),
        ),
      ) as PersonUpdates;

      if (Object.keys(updates).length > 0) {
        await updatePerson(current.person_id, updates);
      }
    } else if (current.change_type === 'add_person') {
      const personInput = payload as Record<string, unknown>;
      if (personInput.full_name) {
        await createPerson(
          {
            family_id: current.family_id,
            full_name: String(personInput.full_name),
            display_name: String(
              personInput.display_name ?? personInput.full_name,
            ),
            gender:
              (personInput.gender as PersonUpdates['gender']) ?? 'unspecified',
            generation_level: Number(personInput.generation_level ?? 1),
            date_precision:
              (personInput.date_precision as PersonUpdates['date_precision']) ??
              'unknown',
            living_status:
              (personInput.living_status as PersonUpdates['living_status']) ??
              'living',
          },
          reviewer.id,
        );
      }
    }
  }

  const reviewed = mapChangeRequest(updated);

  await recordAudit({
    family_id: reviewed.family_id,
    action:
      decision === 'approved'
        ? 'approved change request'
        : 'rejected change request',
    target_type: 'change_request',
    target_id: reviewed.id,
    target_name: reviewed.change_type.replace(/_/g, ' '),
    details:
      reviewNote?.trim() ||
      `${reviewer.display_name} ${decision} the suggested change.`,
  });

  return reviewed;
}
