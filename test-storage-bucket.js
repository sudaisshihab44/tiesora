// Test if storage bucket exists
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   VITE_SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testStorageBucket() {
  console.log('='.repeat(80));
  console.log('📦 TESTING STORAGE BUCKET');
  console.log('='.repeat(80));
  
  try {
    // List all buckets
    console.log('\n1️⃣  Listing all storage buckets...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      return;
    }
    
    console.log(`✅ Found ${buckets.length} buckets:`);
    buckets.forEach(bucket => {
      console.log(`   - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    });
    
    // Check if our specific bucket exists
    console.log('\n2️⃣  Checking for "family-import-pdfs" bucket...');
    const targetBucket = buckets.find(b => b.name === 'family-import-pdfs');
    
    if (!targetBucket) {
      console.error('❌ Bucket "family-import-pdfs" does NOT exist!');
      console.log('\n📋 To create the bucket:');
      console.log('   1. Go to Supabase Dashboard → Storage');
      console.log('   2. Click "New bucket"');
      console.log('   3. Name: family-import-pdfs');
      console.log('   4. Public: No (keep private)');
      console.log('   5. File size limit: 52428800 (50MB)');
      console.log('   6. Allowed MIME types: application/pdf');
      return;
    }
    
    console.log('✅ Bucket "family-import-pdfs" exists!');
    console.log(`   - Public: ${targetBucket.public ? 'Yes' : 'No'}`);
    console.log(`   - Created: ${targetBucket.created_at}`);
    
    // Test bucket access by listing files
    console.log('\n3️⃣  Testing bucket access...');
    const { data: files, error: filesError } = await supabase.storage
      .from('family-import-pdfs')
      .list('', { limit: 10 });
    
    if (filesError) {
      console.error('❌ Error accessing bucket:', filesError);
      console.log('\n📋 Possible issues:');
      console.log('   - Storage policies not configured correctly');
      console.log('   - Service role key missing or invalid');
      return;
    }
    
    console.log('✅ Bucket is accessible!');
    console.log(`   - Files in bucket: ${files.length}`);
    
    if (files.length > 0) {
      console.log('\n📄 Recent files:');
      files.slice(0, 5).forEach(file => {
        console.log(`   - ${file.name} (${Math.round(file.metadata?.size / 1024)}KB)`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ STORAGE BUCKET TEST COMPLETE');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testStorageBucket();
