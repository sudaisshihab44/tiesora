// Database Table Verification Script
// Run this to check if PDF import tables exist in Supabase

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yuysjdytkofnblusdtvu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1eXNqZHl0a29mbmJsdXNkdHZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MTUyNDksImV4cCI6MjEwODM5MTI0OX0.ABpPsSVVJZyFt-X2XXOdV8N5BeKZjigwXQkYQpMVboM';

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
