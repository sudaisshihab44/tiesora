// Database Table Verification Script
// Run this to check if PDF import tables exist in Supabase

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  console.log('🔍 Checking Supabase database tables...\n');

  const tables = [
    'family_import_jobs',
    'family_import_pages',
    'extracted_family_members',
    'extracted_relationships',
    'import_conflicts',
    'import_review_history'
  ];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: ERROR`);
        console.log(`   Code: ${error.code}`);
        console.log(`   Message: ${error.message}`);
        if (error.hint) console.log(`   Hint: ${error.hint}`);
      } else {
        console.log(`✅ ${table}: EXISTS (${count || 0} records)`);
      }
    } catch (err) {
      console.log(`❌ ${table}: EXCEPTION - ${err.message}`);
    }
  }

  console.log('\n🔍 Checking storage bucket...');
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.log(`❌ Storage buckets: ERROR - ${error.message}`);
    } else {
      const pdfBucket = buckets.find(b => b.id === 'family-import-pdfs');
      if (pdfBucket) {
        console.log(`✅ family-import-pdfs bucket: EXISTS`);
        console.log(`   Public: ${pdfBucket.public}`);
        console.log(`   File size limit: ${pdfBucket.file_size_limit} bytes`);
      } else {
        console.log(`❌ family-import-pdfs bucket: NOT FOUND`);
        console.log(`   Available buckets: ${buckets.map(b => b.id).join(', ')}`);
      }
    }
  } catch (err) {
    console.log(`❌ Storage check: EXCEPTION - ${err.message}`);
  }

  console.log('\n✨ Database check complete!');
}

checkTables().catch(console.error);
