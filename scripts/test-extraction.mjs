import 'dotenv/config';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: node scripts/test-extraction.mjs <file.pdf>');
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
const pages = [];
for (let pageNumber = 1; pageNumber <= Math.min(5, pdf.numPages); pageNumber += 1) {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const text = content.items
    .map((item) => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  pages.push(`=== PAGE ${pageNumber} ===\n${text}`);
}
const documentText = pages.join('\n\n');
console.log('batch chars:', documentText.length);

const prompt = `You are an expert genealogist analyzing a family tree document. Extract ALL family members and their relationships. Return ONLY valid JSON with this shape:
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

console.log('calling extract-family-pdf...');
const { data: result, error } = await supabase.functions.invoke(
  'extract-family-pdf',
  { body: { familyId, prompt } },
);

if (error) {
  console.error('Function error:', error.message);
  const context = error.context;
  if (context && typeof context.text === 'function') {
    console.error('Response body:', (await context.text()).slice(0, 1500));
  }
  process.exit(1);
}

const text = typeof result?.text === 'string' ? result.text : '';
console.log('AI text length:', text.length);
console.log('AI text preview:', text.slice(0, 1200));

try {
  const parsed = JSON.parse(text);
  console.log('people:', parsed.people?.length ?? 0);
  console.log('relationships:', parsed.relationships?.length ?? 0);
  console.log('first people:', (parsed.people || []).slice(0, 5).map((p) => p.full_name));
} catch (parseError) {
  console.error('JSON parse failed:', parseError.message);
}
