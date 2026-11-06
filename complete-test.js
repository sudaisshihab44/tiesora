// Complete system test after bucket creation
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const groqApiKey = process.env.VITE_GROQ_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n╔════════════════════════════════════════════════════════════════════╗');
console.log('║             🧪 COMPLETE SYSTEM TEST SUITE                          ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

let allPassed = true;

async function test1_StorageBucket() {
  console.log('TEST 1: Storage Bucket');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) throw error;
    
    const bucket = buckets.find(b => b.name === 'family-import-pdfs');
    
    if (bucket) {
      console.log('✅ PASS: Bucket "family-import-pdfs" exists');
      console.log(`   - Public: ${bucket.public ? 'Yes' : 'No (Correct)'}`);
      console.log(`   - Created: ${bucket.created_at}`);
      return true;
    } else {
      console.log('❌ FAIL: Bucket "family-import-pdfs" not found');
      console.log('   Please run the SQL script first!');
      allPassed = false;
      return false;
    }
  } catch (err) {
    console.log('❌ FAIL: ' + err.message);
    allPassed = false;
    return false;
  }
}

async function test2_SupabaseConnection() {
  console.log('\nTEST 2: Supabase Connection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) throw error;
    
    console.log('✅ PASS: Supabase connection working');
    console.log(`   - URL: ${supabaseUrl}`);
    return true;
  } catch (err) {
    console.log('❌ FAIL: ' + err.message);
    allPassed = false;
    return false;
  }
}

async function test3_DatabaseTables() {
  console.log('\nTEST 3: Database Tables');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const tables = [
    'family_import_jobs',
    'family_import_pages',
    'extracted_family_members',
    'extracted_relationships'
  ];
  
  let allTablesExist = true;
  
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      
      if (error && error.message.includes('does not exist')) {
        console.log(`❌ FAIL: Table "${table}" does not exist`);
        allTablesExist = false;
        allPassed = false;
      } else if (error) {
        console.log(`⚠️  WARN: Table "${table}" - ${error.message}`);
      } else {
        console.log(`✅ PASS: Table "${table}" exists`);
      }
    } catch (err) {
      console.log(`❌ FAIL: Table "${table}" - ${err.message}`);
      allTablesExist = false;
      allPassed = false;
    }
  }
  
  return allTablesExist;
}

async function test4_GroqAPI() {
  console.log('\nTEST 4: Groq API Configuration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (!groqApiKey || groqApiKey === 'your_groq_api_key_here') {
    console.log('❌ FAIL: Groq API key not configured');
    allPassed = false;
    return false;
  }
  
  console.log('✅ PASS: Groq API key configured');
  console.log(`   - Key: ${groqApiKey.substring(0, 20)}...`);
  
  try {
    console.log('   - Testing API connection...');
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [{ role: 'user', content: 'Say "API test successful"' }],
        max_tokens: 20,
        temperature: 0.1
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.choices && data.choices[0]) {
      console.log('✅ PASS: Groq API responding correctly');
      console.log(`   - Response: "${data.choices[0].message.content}"`);
      return true;
    } else {
      console.log('⚠️  WARN: API responded but format unexpected');
      return true;
    }
  } catch (err) {
    console.log('❌ FAIL: Groq API test failed - ' + err.message);
    allPassed = false;
    return false;
  }
}

async function test5_DevServer() {
  console.log('\nTEST 5: Development Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const response = await fetch('http://localhost:3000/');
    
    if (response.ok) {
      console.log('✅ PASS: Dev server responding on port 3000');
      return true;
    } else {
      console.log('⚠️  WARN: Dev server responded with status ' + response.status);
      return true;
    }
  } catch (err) {
    console.log('❌ FAIL: Dev server not responding');
    console.log('   Run: npm run dev');
    allPassed = false;
    return false;
  }
}

async function runAllTests() {
  await test1_StorageBucket();
  await test2_SupabaseConnection();
  await test3_DatabaseTables();
  await test4_GroqAPI();
  await test5_DevServer();
  
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  
  if (allPassed) {
    console.log('║                    🎉 ALL TESTS PASSED! 🎉                         ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');
    console.log('✅ System is ready for PDF import!');
    console.log('');
    console.log('🚀 NEXT STEPS:');
    console.log('   1. Open: http://localhost:3000');
    console.log('   2. Navigate to Family Tree → Import PDF');
    console.log('   3. Upload your PDF file');
    console.log('   4. Watch the console for extraction progress');
    console.log('');
  } else {
    console.log('║                  ⚠️  SOME TESTS FAILED  ⚠️                         ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');
    console.log('❌ System not ready. Fix the failures above.\n');
  }
}

runAllTests();
