import fs from 'fs';
import path from 'path';

// Load .env if present
const envFile = path.resolve(process.cwd(), '.env');
const env = fs.existsSync(envFile)
  ? Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/).filter(Boolean).map(l => {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (!m) return null; const k = m[1]; let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    return [k, v];
  }).filter(Boolean))
  : process.env;

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_BUCKET = 'contracts';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

(async function(){
  try {
    const fname = `SMOKE-REST-${Date.now()}.pdf`;
    const uploadPath = `signed/${fname}`;
    const endpoint = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${uploadPath}`;
    console.log('Uploading to', endpoint);

    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true'
    };

    // Minimal PDF bytes
    const dummy = Buffer.from('%PDF-1.4\n%Dummy PDF\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

    const res = await fetch(endpoint, { method: 'POST', headers, body: dummy });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    try { console.log('Body:', JSON.stringify(JSON.parse(text), null, 2)); } catch(e) { console.log('Body:', text); }

    if (res.ok) {
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${uploadPath}`;
      console.log('Public URL:', publicUrl);
    }

  } catch (e) {
    console.error('Error during upload test:', e);
    process.exit(1);
  }
})();
