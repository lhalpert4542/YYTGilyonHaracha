
/* =====================================================================
   Cloud (Supabase). Used when the site has config.js (Netlify build).
   Opening the file on a computer without config.js runs the test version.
   ===================================================================== */
let SB = null, cloudVersion = 0, synced = null, pushing = false, pushAgain = false, pollTimer = null;
let secrets = {}, auditSent = new Map();
async function sbInit(){
  if(SB) return SB;
  await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js', 'supabase');
  if(!window.supabase || !window.supabase.createClient) throw new Error('Supabase could not load. Check the internet connection and reload.');
  SB = window.supabase.createClient(CFG.supabaseUrl, CFG.supabasePublishableKey, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
  return SB;
}
const sbErr = r => { if(r && r.error) throw new Error(r.error.message || String(r.error)); return r ? r.data : null; };

/* ---- saving: only what changed is sent; the database merges it ---- */
function cloudPush(full){
  if(!canEdit()) return Promise.resolve();
  if(pushing){ pushAgain = true; return persistChain; }
  const now = trackState();
  const ops = (full ? Object.keys(now).map(k=>({p:[k]})) : diffPatch(synced||{}, now)).map(x=>{
    const g = getAt(now, x.p); return g.had ? {p:x.p, had:true, v:g.v} : {p:x.p, had:false};
  });
  if(full) ops.push({p:['schemaVersion'], had:true, v:7});
  if(!ops.length){ setStatus('saved'); flushAuditCloud(); return Promise.resolve(); }
  pushing = true; setStatus('saving');
  persistChain = SB.rpc('gilyon_apply', {ops}).then(r=>{
    pushing = false; cloudVersion = Number(sbErr(r)) || cloudVersion; synced = now; setStatus('saved');
    flushAuditCloud();
    if(pushAgain){ pushAgain = false; cloudPush(); }
  }).catch(err=>{ pushing = false; console.error(err); setStatus('error'); toast('Not saved: '+err.message); });
  return persistChain;
}
/* ---- other people's changes: checked every 20 seconds ---- */
const typingNow = () => { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest('main')); };
async function cloudPull(){
  if(!SB || pushing || pending.length || flushTimer) return;
  try{
    const row = sbErr(await SB.from('gilyon_state').select('version').eq('id','main').maybeSingle());
    if(!row || Number(row.version) <= cloudVersion) return;
    if(canEdit() && synced && diffPatch(synced, trackState()).length){ cloudPush(); return; }   // send my change first
    if(typingNow()) return;                                         // try again next time
    const full = sbErr(await SB.from('gilyon_state').select('data,version').eq('id','main').maybeSingle());
    applyRemote(full);
    renderActive();
  }catch(e){ console.warn('Cloud check failed', e); }
}
// what the database has, in the same shape as trackState()
function remoteTrack(data){ const o = {}; TRACK.forEach(k=>{ if(data && data[k]!==undefined) o[k] = clone(data[k]); }); return o; }
function applyRemote(row){
  const data = (row && row.data) || {};
  TRACK.forEach(k=>{ if(data[k]!==undefined) st[k] = clone(data[k]); });
  cloudVersion = Number(row && row.version || 0);
  synced = remoteTrack(data);
  migrateLoadedState();
  snap = trackState();
  if(canEdit() && diffPatch(synced, snap).length) cloudPush();   // anything the app had to add (new months etc.)
}
function startPoll(){
  clearInterval(pollTimer); pollTimer = setInterval(cloudPull, 20000);
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) cloudPull(); });
}
/* ---- audit log rows (each person sees only their own) ---- */
function flushAuditCloud(){
  if(!SB || !me) return;
  const rows = audit.filter(mine).filter(e=> auditSent.get(e.id)!==JSON.stringify(e));
  if(!rows.length) return;
  const payload = rows.map(e=>({id:e.id, user_email:e.user, ts:e.ts, data:e}));
  SB.from('gilyon_audit').upsert(payload).then(r=>{ if(r.error){ console.warn(r.error); return; } rows.forEach(e=> auditSent.set(e.id, JSON.stringify(e))); });
}
async function loadAuditCloud(){
  const cut = Date.now() - AUDIT_DAYS*864e5;
  try{ await SB.from('gilyon_audit').delete().lt('ts', cut).eq('user_email', me.email); }catch(e){}
  const rows = sbErr(await SB.from('gilyon_audit').select('data').eq('user_email', me.email).gte('ts', cut).order('ts', {ascending:false}).limit(2000)) || [];
  audit = rows.map(r=>r.data).filter(Boolean);
  audit.forEach(e=> auditSent.set(e.id, JSON.stringify(e)));
}
/* ---- letterhead & AI key ---- */
async function loadAssetsCloud(){
  const r = await SB.from('gilyon_assets').select('id,data').eq('id','letterhead').maybeSingle();
  assets.letterheadDataUrl = (r.data && r.data.data) || null;
}
function saveAssetsCloud(){
  setStatus('saving');
  persistChain = persistChain.then(async ()=>{
    const r = assets.letterheadDataUrl ? await SB.from('gilyon_assets').upsert({id:'letterhead', data:assets.letterheadDataUrl}) : await SB.from('gilyon_assets').delete().eq('id','letterhead');
    if(r.error){ setStatus('error'); toast('Letterhead not saved: '+r.error.message); } else setStatus('saved');
  });
}
async function loadSecretsCloud(){
  if(!canEdit()) return;
  const r = await SB.from('gilyon_secrets').select('data').eq('id','ai').maybeSingle();
  secrets = (r.data && r.data.data) || {};
}
async function saveSecretsCloud(){
  const r = await SB.from('gilyon_secrets').upsert({id:'ai', data:secrets});
  if(r.error) toast('Not saved: '+r.error.message);
}
/* ---- users ---- */
async function loadUsersCloud(){
  users = (sbErr(await SB.from('gilyon_users').select('*').order('email')) || []).map(u=>({id:u.id, email:u.email, name:u.name||'', role:u.role, active:u.active, lastLogin:u.last_login}));
}
