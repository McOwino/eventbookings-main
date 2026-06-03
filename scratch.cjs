const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL="(.*)"/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/)[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);
async function test() {
  const { data, error } = await supabase.from('feedback').select('*').gte('score', 7).limit(5);
  console.log('ERROR:', error);
  console.log('DATA:', data);
}
test();
