// Automated storage bucket creation script
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('═══════════════════════════════════════════════════════════════');
console.log('🚀 AUTOMATED STORAGE BUCKET CREATION');
console.log('═══════════════════════════════════════════════════════════════\n');

async function createBucketWithSQL() {
  console.log('📋 Attempting to create bucket via SQL RPC...\n');
  
  // Try to create bucket using SQL
  const createBucketSQL = `
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'family-import-pdfs',
      'family-import-pdfs',
      false,
      52428800,
      ARRAY['application/pdf']::text[]
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING *;
  `;
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: createBucketSQL 
    });
    
    if (error) {
      console.log('⚠️  RPC method not available, trying direct API...\n');
      return await createBucketDirect();
    }
    
    console.log('✅ Bucket created successfully via SQL!');
    return true;
  } catch (err) {
    console.log('⚠️  SQL method failed, trying direct API...\n');
    return await createBucketDirect();
  }
}

async function createBucketDirect() {
  console.log('📋 Attempting to create bucket via Storage API...\n');
  
  try {
    const { data, error } = await supabase.storage.createBucket('family-import-pdfs', {
      public: false,
      fileSizeLimit: 52428800,
      allowedMimeTypes: ['application/pdf'],
    });
    
    if (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Bucket already exists!');
        return true;
      }
      throw error;
    }
    
    console.log('✅ Bucket created successfully via API!');
    return true;
  } catch (err) {
    console.error('❌ Failed to create bucket:', err.message);
    return false;
  }
}

async function verifyBucket() {
  console.log('\n📦 Verifying bucket exists...\n');
  
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) throw error;
    
    const bucket = buckets.find(b => b.name === 'family-import-pdfs');
    
    if (bucket) {
      console.log('✅ BUCKET VERIFIED!');
      console.log(`   - Name: ${bucket.name}`);
      console.log(`   - Public: ${bucket.public ? 'Yes' : 'No'}`);
      console.log(`   - Created: ${bucket.created_at}`);
      return true;
    } else {
      console.log('❌ Bucket not found after creation attempt');
      return false;
    }
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    return false;
  }
}

async function showManualInstructions() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📋 MANUAL BUCKET CREATION REQUIRED');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('Please create the bucket manually using ONE of these methods:\n');
  console.log('METHOD 1: Supabase Dashboard');
  console.log('─────────────────────────────');
  console.log('1. Go to: https://app.supabase.com/project/_/storage/buckets');
  console.log('2. Click "New bucket"');
  console.log('3. Name: family-import-pdfs');
  console.log('4. Public: No (private)');
  console.log('5. Click "Create bucket"\n');
  console.log('METHOD 2: SQL Editor');
  console.log('────────────────────');
  console.log('1. Go to: https://app.supabase.com/project/_/sql');
  console.log('2. Run the SQL in: supabase/migrations/APPLY_TO_SUPABASE.sql');
  console.log('3. Look for the "STORAGE BUCKET for PDF imports" section\n');
  console.log('After creating, run: node test-storage-bucket.js');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

async function main() {
  // First check if bucket already exists
  console.log('1️⃣  Checking if bucket already exists...\n');
  
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const existing = buckets?.find(b => b.name === 'family-import-pdfs');
    
    if (existing) {
      console.log('✅ Bucket "family-import-pdfs" already exists!\n');
      await verifyBucket();
      console.log('\n🎉 SUCCESS! You can now test PDF import.');
      return;
    }
  } catch (err) {
    console.log('⚠️  Could not check existing buckets\n');
  }
  
  // Try to create bucket
  console.log('2️⃣  Bucket does not exist. Creating...\n');
  
  const created = await createBucketWithSQL();
  
  if (created) {
    const verified = await verifyBucket();
    
    if (verified) {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('🎉 SUCCESS! Storage bucket is ready!');
      console.log('═══════════════════════════════════════════════════════════════\n');
      console.log('✅ Next steps:');
      console.log('   1. Open: http://localhost:3000/diagnostic-dashboard.html');
      console.log('   2. Click "Test Storage Bucket" - should show green ✓');
      console.log('   3. Go to main app and test PDF import!\n');
    } else {
      await showManualInstructions();
    }
  } else {
    await showManualInstructions();
  }
}

main();
