import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env
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
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('.env missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function compressPayload(str) {
  return Buffer.from(encodeURIComponent(str)).toString('base64')
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function buildSignLink(data, origin='http://localhost:8081'){
  const linkId = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  const encoded = compressPayload(JSON.stringify(data));
  const base = `${origin}/sign`;
  return `${base}?c=${encodeURIComponent(encoded)}&id=${linkId}`;
}

(async()=>{
  try{
    console.log('Selecting an existing event for smoke test...');
    const { data: eventsList, error: evErr } = await supabase.from('events').select('*').neq('status','canceled').order('created_at',{ascending:false}).limit(1);
    if (evErr) throw evErr;
    if (!eventsList || eventsList.length === 0) {
      throw new Error('No existing events found to run smoke test against');
    }
    const ev = eventsList[0];
    console.log('Using event id=', ev.id, 'client=', ev.client_name);
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const evtDate = new Date(ev.event_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const contractPayload = {
      etype: ev.event_type,
      fac: ev.facility,
      name: ev.client_name,
      contact: ev.contact_number,
      email: ev.email,
      org: ev.organization,
      pkg: ev.package_name,
      pax: ev.pax,
      cpp: ev.cost_per_person,
      startTime: ev.start_time,
      endTime: ev.end_time,
      notes: ev.notes,
      till: '',
      bdayPersons: ev.birthday_persons ?? [],
      schPkgs: ev.package_options ?? [],
      evtDate, today, total: Number(ev.pax)*Number(ev.cost_per_person), eventId: ev.id
    };
    const inserted = ev;

    const signLink = buildSignLink(contractPayload);
    console.log('Generated sign link:', signLink);

    console.log('NOTE: cannot insert into `contracts` due to RLS with publishable key; skipping DB insert/upsert');
    console.log('Sign link (open this in browser to sign):', signLink);
    const url = new URL(signLink);
    console.log('Checking sign page URL:', url.href);
    const res = await fetch(url.href);
    console.log('Sign page response status:', res.status);

    // Create a dummy signed PDF and upload
    console.log('Uploading dummy signed PDF to storage (will not update DB due to RLS)...');
    const dummy = Buffer.from('%PDF-1.4\n%Dummy PDF for smoke test\n');
    const fname = `signed/SMOKE-${inserted.id}.pdf`;
    const { error: upErr } = await supabase.storage.from('contracts').upload(fname, dummy, { contentType: 'application/pdf', upsert: true });
    if (upErr) {
      console.error('Upload error (may be RLS/storage policy):', upErr);
    } else {
      const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(fname);
      console.log('Uploaded signed PDF public URL:', urlData.publicUrl);
    }

    console.log('Smoke test (partial) completed: sign link generated and file uploaded to storage (if permitted).');
  } catch (e){
    console.error('Smoke test failed', e);
    process.exit(1);
  }
})();
