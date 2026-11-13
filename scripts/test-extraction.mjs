import 'dotenv/config';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const args = process.argv.slice(2);
const processAll = args.includes('--all');
const pdfPath = args.find((arg) => !arg.startsWith('--'));

if (!pdfPath) {
  console.error(
    'Usage: node scripts/test-extraction.mjs <file.pdf> [--all]',
  );
  process.exit(1);
}

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
console.log('admin sign-in: OK');

const { data: families, error: familyError } = await supabase
  .from('families')
  .select('id,name')
  .eq('name', 'Bootstrap Test Family')
  .limit(1);
if (familyError || !families?.length) {
  console.error('Family lookup failed:', familyError?.message || 'not found');
  process.exit(1);
}
const familyId = families[0].id;
console.log('family:', families[0].name, familyId);

const data = new Uint8Array(fs.readFileSync(pdfPath));
const pdf = await getDocument({ data }).promise;

const pageTexts = [];
for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const text = content.items
    .map((item) => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  pageTexts.push({ pageNumber, text });
}

const BATCH_SIZE = 5;
const batches = [];
for (let i = 0; i < pageTexts.length; i += BATCH_SIZE) {
  batches.push(pageTexts.slice(i, i + BATCH_SIZE));
}

const selectedBatches = processAll ? batches : batches.slice(0, 1);
console.log(
  `pages: ${pdf.numPages}, batches: ${batches.length}, testing: ${selectedBatches.length}`,
);

function buildPrompt(batch) {
  const documentText = batch
    .map((p) => `=== PAGE ${p.pageNumber} ===\n${p.text}`)
    .join('\n\n');

  return `You are an expert genealogist analyzing a family tree document. Extract ALL family members and their relationships. Return ONLY valid JSON with this shape:
{
  "people": [
    {
      "full_name": "string",
      "display_name": "string",
      "generation_label": "string or null",
      "generation_level": 1,
      "gender": "male|female|other|unspecified",
      "birth_year": null,
      "birth_date": null,
      "birth_place": null,
      "death_year": null,
      "death_date": null,
      "death_place": null,
      "living_status": "living|deceased|unknown",
      "child_number": null,
      "branch": "string or null",
      "biography": null,
      "source_pages": [1],
      "confidence": 0.8
    }
  ],
  "relationships": [
    {
      "source_name": "string",
      "target_name": "string",
      "type": "parent|spouse|child|sibling|adoptive_parent|adopted_child",
      "source_pages": [1],
      "confidence": 0.8
    }
  ],
  "generation_structure": [],
  "branches": [],
  "document_notes": "string"
}

DOCUMENT CONTENT:
${documentText}`;
}

let totalPeople = 0;
let totalRelationships = 0;
const uniqueNames = new Set();

for (let index = 0; index < selectedBatches.length; index += 1) {
  const batch = selectedBatches[index];
  const firstPage = batch[0].pageNumber;
  const lastPage = batch[batch.length - 1].pageNumber;
  const prompt = buildPrompt(batch);

  try {
    const { data: result, error } = await supabase.functions.invoke(
      'extract-family-pdf',
      { body: { familyId, prompt } },
    );

    if (error) {
      const context = error.context;
      const detail =
        context && typeof context.text === 'function'
          ? (await context.text()).slice(0, 500)
          : error.message;
      console.error(
        `batch ${index + 1} (pages ${firstPage}-${lastPage}): ERROR ${detail}`,
      );
      continue;
    }

    const text = typeof result?.text === 'string' ? result.text : '';
    const parsed = JSON.parse(text);
    const people = parsed.people || [];
    const relationships = parsed.relationships || [];

    totalPeople += people.length;
    totalRelationships += relationships.length;
    people.forEach((person) => {
      if (person.full_name) uniqueNames.add(person.full_name);
    });

    console.log(
      `batch ${index + 1} (pages ${firstPage}-${lastPage}): ` +
        `${people.length} people, ${relationships.length} relationships`,
    );
  } catch (batchError) {
    console.error(
      `batch ${index + 1} (pages ${firstPage}-${lastPage}): ` +
        `${batchError instanceof Error ? batchError.message : String(batchError)}`,
    );
  }

  if (index < selectedBatches.length - 1) {
    // Gemini's free tier is ~15 RPM; pace at 12 RPM for the diagnostic.
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

console.log('----------------------------------------');
console.log(`people: ${totalPeople} (${uniqueNames.size} unique names)`);
console.log(`relationships: ${totalRelationships}`);
