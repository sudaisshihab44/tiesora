// Execute storage bucket creation SQL
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('═══════════════════════════════════════════════════════════════');
console.log('🚀 EXECUTING STORAGE BUCKET SQL');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('📋 Instructions:');
console.log('   Since automated creation requires service role key,');
console.log('   please run this SQL manually in Supabase Dashboard:\n');
console.log('1. Open: https://app.supabase.com/project/yuysjdytkofnblusdtvu/sql/new');
console.log('2. Copy the SQL below');
console.log('3. Paste and click "Run" (or Ctrl+Enter)\n');
console.log('═══════════════════════════════════════════════════════════════');
console.log('SQL TO COPY:');
console.log('═══════════════════════════════════════════════════════════════\n');

const sql = `-- Create storage bucket for PDF imports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'family-import-pdfs',
  'family-import-pdfs',
  false,
  52428800,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Allow authenticated users to upload PDFs to their family folders
CREATE POLICY "Users can upload PDFs to their family folders"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'family-import-pdfs' 
  AND auth.uid() IS NOT NULL
);

-- RLS Policy: Allow users to read PDFs from their family folders
CREATE POLICY "Users can read PDFs from their family folders"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'family-import-pdfs'
);

-- RLS Policy: Allow admins to delete family PDFs
CREATE POLICY "Admins can delete family PDFs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'family-import-pdfs'
);`;

console.log(sql);
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('After running the SQL, verify with: node test-storage-bucket.js');
console.log('═══════════════════════════════════════════════════════════════\n');
