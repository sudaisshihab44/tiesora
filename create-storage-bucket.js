// Create the family-import-pdfs storage bucket
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createBucket() {
  console.log('='.repeat(80));
  console.log('📦 CREATING STORAGE BUCKET');
  console.log('='.repeat(80));
  
  try {
    // Create the bucket
    console.log('\n1️⃣  Creating "family-import-pdfs" bucket...');
    const { data, error } = await supabase.storage.createBucket('family-import-pdfs', {
      public: false,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['application/pdf'],
    });
    
    if (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Bucket already exists!');
      } else {
        console.error('❌ Error creating bucket:', error);
        return;
      }
    } else {
      console.log('✅ Bucket created successfully!');
      console.log('   Data:', data);
    }
    
    // Verify bucket was created
    console.log('\n2️⃣  Verifying bucket exists...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      return;
    }
    
    const bucket = buckets.find(b => b.name === 'family-import-pdfs');
    if (bucket) {
      console.log('✅ Bucket verified!');
      console.log(`   - Name: ${bucket.name}`);
      console.log(`   - Public: ${bucket.public}`);
      console.log(`   - Created: ${bucket.created_at}`);
    } else {
      console.error('❌ Bucket not found after creation!');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ STORAGE BUCKET SETUP COMPLETE');
    console.log('='.repeat(80));
    console.log('\n📋 Next steps:');
    console.log('   1. Test PDF upload in the application');
    console.log('   2. Check console logs for extraction progress');
    console.log('   3. Verify data appears in review dashboard');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createBucket();
