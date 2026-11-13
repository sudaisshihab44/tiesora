import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@tiesora.test';
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!url || !anonKey || !password) {
  console.error('Missing Supabase env or BOOTSTRAP_ADMIN_PASSWORD in .env');
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const login = await supabase.auth.signInWithPassword({ email, password });
if (login.error) {
  console.error('Admin sign-in failed:', login.error.message);
  process.exit(1);
}

const { data: families, error: familyError } = await supabase
  .from('families')
  .select('id,name')
  .eq('name', 'Bootstrap Test Family')
  .limit(1);
if (familyError || !families?.length) {
  console.error('Family lookup failed:', familyError?.message || 'not found');
  process.exit(1);
}

const { data: jobs, error: jobError } = await supabase
  .from('family_import_jobs')
  .select('id,status,created_at')
  .eq('family_id', families[0].id)
  .eq('status', 'processed')
  .order('created_at', { ascending: false })
  .limit(1);
if (jobError || !jobs?.length) {
  console.error('No processed import job found:', jobError?.message);
  process.exit(1);
}
const jobId = jobs[0].id;
console.log('job:', jobId);

const { data: members, error: memberError } = await supabase
  .from('extracted_family_members')
  .select('id,full_name,generation_label,generation_level')
  .eq('import_job_id', jobId);
if (memberError) throw memberError;

const { data: relationships, error: relationshipError } = await supabase
  .from('extracted_relationships')
  .select('source_extracted_id,target_extracted_id,relationship_type')
  .eq('import_job_id', jobId);
if (relationshipError) throw relationshipError;

function labelToLevel(label) {
  if (!label) return undefined;
  const match = String(label).trim().match(/^([A-Za-z])/);
  if (!match) return undefined;
  const level = match[1].toUpperCase().charCodeAt(0) - 64;
  return level >= 1 && level <= 26 ? level : undefined;
}

const levelById = new Map();
for (const member of members) {
  const level = labelToLevel(member.generation_label);
  if (level) levelById.set(member.id, level);
}

const parents = new Map();
const children = new Map();
const spouses = new Map();

const addToMap = (map, key, value) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
};

for (const rel of relationships) {
  const source = rel.source_extracted_id;
  const target = rel.target_extracted_id;
  if (!source || !target) continue;

  if (['parent', 'adoptive_parent', 'step_parent'].includes(rel.relationship_type)) {
    addToMap(parents, target, source);
    addToMap(children, source, target);
  } else if (['spouse', 'partner'].includes(rel.relationship_type)) {
    addToMap(spouses, source, target);
    addToMap(spouses, target, source);
  }
}

function propagate() {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, level] of [...levelById.entries()]) {
      for (const child of children.get(id) || []) {
        if (!levelById.has(child)) {
          levelById.set(child, level + 1);
          changed = true;
        }
      }
      for (const parent of parents.get(id) || []) {
        if (!levelById.has(parent)) {
          levelById.set(parent, Math.max(1, level - 1));
          changed = true;
        }
      }
      for (const spouse of spouses.get(id) || []) {
        if (!levelById.has(spouse)) {
          levelById.set(spouse, level);
          changed = true;
        }
      }
    }
  }
}

propagate();

// Unlabeled roots (no parent) start at level 1, then propagate.
for (const member of members) {
  if (!levelById.has(member.id) && !(parents.get(member.id) || []).length) {
    levelById.set(member.id, 1);
  }
}
propagate();

// Anything still disconnected defaults to level 1.
for (const member of members) {
  if (!levelById.has(member.id)) levelById.set(member.id, 1);
}

const distribution = new Map();
for (const member of members) {
  const level = levelById.get(member.id);
  distribution.set(level, (distribution.get(level) || 0) + 1);
}
console.log('level distribution:', Object.fromEntries([...distribution.entries()].sort((a, b) => a[0] - b[0])));

const updates = members.filter(
  (member) => member.generation_level !== levelById.get(member.id),
);
console.log('rows to update:', updates.length);

for (let i = 0; i < updates.length; i += 20) {
  const batch = updates.slice(i, i + 20);
  const results = await Promise.all(
    batch.map((member) =>
      supabase
        .from('extracted_family_members')
        .update({ generation_level: levelById.get(member.id) })
        .eq('id', member.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed) throw failed.error;
  console.log(`updated ${Math.min(i + batch.length, updates.length)}/${updates.length}`);
}

console.log('Generation levels backfilled.');
