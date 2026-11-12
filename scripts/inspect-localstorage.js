/**
 * ============================================================================
 * Tiesora - localStorage inspector (READ-ONLY)
 *
 * Purpose: before we move the app to Supabase as the source of truth, we need
 * to know whether your browser holds sample data or real family data.
 *
 * How to use:
 *   1. Open the running Tiesora app in the browser/profile you normally use.
 *      (The origin must match where you used the app, e.g. localhost:3000.)
 *   2. Open DevTools -> Console.
 *   3. Paste this entire file, press Enter.
 *   4. It prints a summary table and downloads a JSON backup.
 *
 * Privacy:
 *   - It only reads `kinroots_*` data keys.
 *   - Supabase auth keys (`tiesora_auth_v1`, `sb-*`) are detected but their
 *     contents are NOT printed or exported.
 *   - The downloaded JSON contains family data. Treat it as private.
 * ============================================================================
 */
(() => {
  const DATA_PREFIX = 'kinroots_';
  const AUTH_PREFIXES = ['tiesora_auth', 'sb-'];
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const allKeys = Object.keys(localStorage).sort();
  const dataKeys = allKeys.filter(k => k.startsWith(DATA_PREFIX));
  const authKeys = allKeys.filter(k => AUTH_PREFIXES.some(p => k.startsWith(p)));

  const parsed = {};
  const summary = {};

  for (const key of dataKeys) {
    const raw = localStorage.getItem(key) ?? '';
    let value;
    let parseError = '';
    try {
      value = JSON.parse(raw);
    } catch (err) {
      value = raw;
      parseError = String((err && err.message) || err);
    }
    parsed[key] = value;
    const isArray = Array.isArray(value);
    summary[key] = {
      bytes: raw.length,
      kind: isArray ? 'array' : typeof value,
      count: isArray
        ? value.length
        : value && typeof value === 'object'
          ? Object.keys(value).length
          : '',
      parse_error: parseError,
    };
  }

  for (const key of authKeys) {
    summary[key] = {
      bytes: (localStorage.getItem(key) || '').length,
      kind: 'auth (redacted)',
      count: '',
      parse_error: '',
    };
  }

  const getArray = key => (Array.isArray(parsed[key]) ? parsed[key] : []);

  const families = getArray('kinroots_families_v1');
  const people = getArray('kinroots_people_v1');
  const relationships = getArray('kinroots_relationships_v1');
  const memories = getArray('kinroots_memories_v1');
  const events = getArray('kinroots_events_v1');
  const memberships = getArray('kinroots_memberships_v1');
  const changeRequests = getArray('kinroots_change_requests_v1');
  const notifications = getArray('kinroots_notifications_v1');
  const auditLogs = getArray('kinroots_audit_logs_v1');
  const invitations = getArray('kinroots_invitations_v1');

  const familiesOverview = families.map(f => ({
    id: f.id,
    name: f.name,
    owner_id: f.owner_id,
    created_at: f.created_at,
    people: people.filter(p => p.family_id === f.id).length,
    relationships: relationships.filter(r => r.family_id === f.id).length,
    memories: memories.filter(m => m.family_id === f.id).length,
    events: events.filter(e => e.family_id === f.id).length,
    memberships: memberships.filter(m => m.family_id === f.id).length,
    is_sample:
      f.id === 'fam_montgomery_chen' ||
      /Montgomery-Vance/i.test(String(f.name || '')),
  }));

  const verdictInputs = {
    families_total: families.length,
    people_total: people.length,
    relationships_total: relationships.length,
    memories_total: memories.length,
    events_total: events.length,
    memberships_total: memberships.length,
    change_requests_total: changeRequests.length,
    notifications_total: notifications.length,
    audit_logs_total: auditLogs.length,
    invitations_total: invitations.length,
    sample_family_rows: families.filter(f => f.id === 'fam_montgomery_chen').length,
    families_with_non_uuid_id: families.filter(f => !UUID_RE.test(String(f.id))).length,
    people_with_non_uuid_id: people.filter(p => !UUID_RE.test(String(p.id))).length,
    memories_with_embedded_images: memories.filter(
      m => typeof m.image_url === 'string' && m.image_url.startsWith('data:')
    ).length,
    /*
     * If this is 0, your browser has never held anything except the built-in
     * Montgomery-Vance sample. If it is > 0, we must migrate your data.
     */
    non_sample_family_rows: families.filter(
      f => f.id !== 'fam_montgomery_chen' && !/Montgomery-Vance/i.test(String(f.name || ''))
    ).length,
    data_bytes_total: dataKeys.reduce(
      (n, k) => n + (localStorage.getItem(k) || '').length,
      0
    ),
  };

  console.log('%cTiesora localStorage summary', 'font-weight:bold;font-size:14px');
  console.table(summary);

  console.log('%cFamilies overview', 'font-weight:bold;font-size:14px');
  console.table(familiesOverview);

  console.log('%cVerdict inputs', 'font-weight:bold;font-size:14px');
  console.table(verdictInputs);

  const verdict =
    verdictInputs.non_sample_family_rows > 0
      ? 'REAL DATA LIKELY - migrate before switching to Supabase.'
      : 'SAMPLE DATA ONLY - safe to reset.';

  console.log(
    '%c' + verdict,
    verdict.startsWith('REAL')
      ? 'color:#b91c1c;font-weight:bold;font-size:13px'
      : 'color:#047857;font-weight:bold;font-size:13px'
  );

  const payload = {
    exported_at: new Date().toISOString(),
    origin: location.origin,
    note: 'Supabase auth keys are intentionally excluded.',
    summary,
    families_overview: familiesOverview,
    verdict_inputs: verdictInputs,
    verdict,
    keys: parsed,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  anchor.href = url;
  anchor.download = `tiesora-localstorage-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  console.log(
    '%cDownloaded a JSON backup. Treat it as private family data.',
    'color:#b45309;font-weight:bold'
  );
})();
