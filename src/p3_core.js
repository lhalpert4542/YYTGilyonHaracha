<script>
(function(){
'use strict';
/* =====================================================================
   Storage – this version saves in this browser (IndexedDB).
   Same data shape as the cloud version will use.
   ===================================================================== */
const DB_NAME = 'gilyon_eval_local';
const KV = (()=>{
  let dbp = null;
  function open(){
    if(dbp) return dbp;
    dbp = new Promise((res, rej)=>{
      if(!window.indexedDB) return rej(new Error('no indexedDB'));
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = ()=> r.result.createObjectStore('kv');
      r.onsuccess = ()=> res(r.result);
      r.onerror = ()=> rej(r.error);
    });
    return dbp;
  }
  async function get(k){
    try{ const db = await open(); return await new Promise((res, rej)=>{ const q = db.transaction('kv','readonly').objectStore('kv').get(k); q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); }); }
    catch(e){ const v = localStorage.getItem(DB_NAME+'_'+k); return v ? JSON.parse(v) : undefined; }
  }
  async function set(k, v){
    try{ const db = await open(); await new Promise((res, rej)=>{ const tx = db.transaction('kv','readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); }); }
    catch(e){ localStorage.setItem(DB_NAME+'_'+k, JSON.stringify(v)); }
  }
  return {get, set};
})();

/* ---------------- constants ---------------- */
const DEFAULT_LETTERHEAD_DATAURL = '__LH__';
const HEB_MONTHS = ['אלול','תשרי','חשוון','כסלו','טבת','שבט','אדר','ניסן','אייר','סיון'];
const MONTH_ALIASES = {'חשון':'חשוון','מרחשוון':'חשוון','סיוון':'סיון','כסליו':'כסלו'};
const SAMPLE_MONTH_LEGACY = 'אייר תשפ״ו (לדוגמה)';
const AUDIT_DAYS = 7, AUDIT_PAGE = 25;
const DEFAULT_LAYOUT = {topMM:68, bottomMM:50, leftMM:25, rightMM:25};

function defaultSubjects(){
  return [
    {id:'mishnayot', label:'משניות', kind:'week'},
    {id:'chumash', label:'חומש', kind:'week'},
    {id:'benAdam', label:'בן אדם לחבירו', kind:'cat'},
    {id:'tefila', label:'תפילה', kind:'cat'},
    {id:'hakshava', label:'הקשבה־והתמדה', kind:'cat'},
    {id:'hanhaga', label:'התנהגות', kind:'cat'}
  ];
}
const DEFAULT_REPORT_TEXT = {
  title: '"גליון הערכה"',
  lead: "לכבוד ההורים החשובים שיחי'\nהנני בזה להביא לידיעתכם את תוצאות הבחינות\nשל חודש {month} של בנכם",
  classLine: 'בכתה {class} · {teacher} שליט"א',
  note: 'הערה: עס מאכט זיך אמאל אז דאס קינד לערנט בעסער פון וואס עס שטעלט זיך ארויס אויף די בחינה.',
  scoreNote: 'הציונים ווערן גערעכנט פון 1–10, 10 איז די בעסטע',
  signature: 'חתימת ההורים',
  weekHeader: 'פרשת', lateHeader: 'איחורים', absentHeader: 'חסרים', earlyHeader: 'יצא מוקדם'
};
const SIZE_LABELS = {title:'Title', lead:'Opening text', name:'Student name', classline:'Class line', thead:'Table headers', tbody:'Table scores', note:'Notes', sign:'Signature'};
const DEFAULT_SIZES = {title:28, lead:16, name:30, classline:15, thead:15, tbody:16, note:13, sign:15};

const st = {
  classes: [], staff: [], students: {}, months: [], grades: {},
  sheets: {}, reportStatus: {},
  currentYear: '',
  reportText: Object.assign({}, DEFAULT_REPORT_TEXT),
  layout: Object.assign({}, DEFAULT_LAYOUT),
  sizes: Object.assign({}, DEFAULT_SIZES),
  printLetterhead: true,
  reportPresets: [],
  dashboardThresholds: {absences:3, lates:3, low:70, high:85}
};
const assets = { letterheadDataUrl:null };
let currentLetterheadDataUrl = DEFAULT_LETTERHEAD_DATAURL;

/* ---------------- helpers ---------------- */
const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2,10);
const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const clone = v => v===undefined ? undefined : JSON.parse(JSON.stringify(v));
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const isHeb = s => /[֐-׿]/.test(String(s||''));
const enName = x => x ? (x.name || x.nameHe || '') : '';
const heName = x => x ? (x.nameHe || x.name || '') : '';
const he = s => `<span class="he">${esc(s)}</span>`;
function hashStr(s){ let h = 2166136261; s = String(s); for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h>>>0).toString(36); }
const ICON = {
  edit:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  plus:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  undo:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 2.64-6.36"/><polyline points="3 3 3 9 9 9"/></svg>',
  redo:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>',
  key:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/></svg>',
  ban:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>',
  check:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  eye:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>',
  left:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  right:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  print:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  scan:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>',
  view:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
};
function iconBtn(icon, tip, attrs='', cls=''){ return `<button type="button" class="icon-btn ${cls}" data-tip="${esc(tip)}" aria-label="${esc(tip)}" ${attrs}>${ICON[icon]}</button>`; }
function fillSelect(sel, items, valFn, labelFn, placeholder){
  const prev = sel.value;
  sel.innerHTML = (placeholder ? `<option value="">${esc(placeholder)}</option>` : '') + items.map(it=>`<option value="${esc(valFn(it))}">${esc(labelFn(it))}</option>`).join('');
  if(items.some(it=>String(valFn(it))===prev)) sel.value = prev;
}
const options = (items, valFn, labelFn, cur) => items.map(it=>`<option value="${esc(valFn(it))}" ${String(valFn(it))===String(cur)?'selected':''}>${esc(labelFn(it))}</option>`).join('');

/* ---------------- Hebrew years & months ---------------- */
function hebYearStr(n){
  let v = n % 1000, out = '';
  [[400,'ת'],[300,'ש'],[200,'ר'],[100,'ק']].forEach(([val,ch])=>{ while(v>=val){ out+=ch; v-=val; } });
  if(v===15) out+='טו'; else if(v===16) out+='טז';
  else { const tens = ['','י','כ','ל','מ','נ','ס','ע','פ','צ'], ones = ['','א','ב','ג','ד','ה','ו','ז','ח','ט']; out += tens[Math.floor(v/10)] + ones[v%10]; }
  return out.length>1 ? out.slice(0,-1)+'"'+out.slice(-1) : out+"'";
}
const GEM = {'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,'י':10,'כ':20,'ך':20,'ל':30,'מ':40,'ם':40,'נ':50,'ן':50,'ס':60,'ע':70,'פ':80,'ף':80,'צ':90,'ץ':90,'ק':100,'ר':200,'ש':300,'ת':400};
function parseHebYear(s){
  const letters = String(s||'').replace(/["'״׳]/g,'');
  if(!letters || /[^א-ת]/.test(letters)) return null;
  let sum = 0; for(const ch of letters){ if(!GEM[ch]) return null; sum += GEM[ch]; }
  return sum < 1000 ? 5000 + sum : sum;
}
function normYear(s){ const n = parseHebYear(s); return n ? hebYearStr(n) : String(s||''); }
function currentSchoolYearNum(){ const d = new Date(); return d.getFullYear() + 3760 + (d.getMonth() >= 7 ? 1 : 0); }
function monthName(label){ const first = String(label||'').trim().split(/\s+/)[0]; return MONTH_ALIASES[first] || first; }
function monthSchoolYear(label){
  const parts = String(label||'').trim().split(/\s+/);
  if(parts.length < 2) return null;
  const y = parseHebYear(parts[1]); if(!y) return null;
  return hebYearStr(monthName(label)==='אלול' ? y+1 : y);
}
function monthOrder(m){ const i = HEB_MONTHS.indexOf(monthName(m.label)); return i===-1 ? 100 : i; }
function yearNum(y){ return parseHebYear(y) || 0; }
function monthsOfYear(y){ return st.months.filter(m=>m.year===y).sort((a,b)=> monthOrder(a)-monthOrder(b) || st.months.indexOf(a)-st.months.indexOf(b)); }
function sortedMonths(){ return monthsOfYear(st.currentYear); }
function schoolYears(){ const set = new Set(st.months.map(m=>m.year).filter(Boolean)); if(st.currentYear) set.add(st.currentYear); return Array.from(set).sort((a,b)=>yearNum(a)-yearNum(b)); }
function addMonth(label, year){
  label = String(label||'').trim(); if(!label) return null;
  let m = st.months.find(x=>x.label===label);
  if(!m){ m = {id:uid(), label, year: year || monthSchoolYear(label) || st.currentYear}; st.months.push(m); }
  return m;
}
function ensureYearMonths(y){ const n = yearNum(y); if(!n) return; HEB_MONTHS.forEach(mn=> addMonth(mn+' '+hebYearStr(mn==='אלול' ? n-1 : n), y)); }
const monthById = id => st.months.find(m=>m.id===id);

/* ---------------- shape / migration ---------------- */
const classById = id => st.classes.find(c=>c.id===id);
const staffById = id => st.staff.find(s=>s.id===id);
const teacherOf = cls => staffById(cls && cls.teacherId);
const studentsOf = classId => st.students[classId] || [];
function ensureClassShape(cls){ if(!cls.subjects || !cls.subjects.length) cls.subjects = defaultSubjects(); return cls; }
function migrateStudentRecord(d){
  if(d && d.cat && d.week) return d;
  const nd = {chesarim:(d&&d.chesarim)||'', ichurim:(d&&d.ichurim)||'', yatza:(d&&d.yatza)||'', cat:{}, week:{}};
  ['benAdam','tefila','hakshava','hanhaga'].forEach(k=>{ nd.cat[k] = (d && d[k]!==undefined) ? d[k] : ''; });
  const weeks = (d && d.weeks) || [];
  nd.week.mishnayot = [0,1,2,3].map(i=> (weeks[i] && weeks[i].mishnayot!==undefined) ? weeks[i].mishnayot : '');
  nd.week.chumash = [0,1,2,3].map(i=> (weeks[i] && weeks[i].chumash!==undefined) ? weeks[i].chumash : '');
  return nd;
}
function ensureRecordShape(d, cls){
  if(!d.cat) d.cat = {};
  if(!d.week) d.week = {};
  ['chesarim','ichurim','yatza'].forEach(k=>{ if(d[k]===undefined) d[k]=''; });
  (cls.subjects||[]).forEach(s=>{
    if(s.kind==='cat'){ if(d.cat[s.id]===undefined) d.cat[s.id] = ''; }
    else { if(!Array.isArray(d.week[s.id])) d.week[s.id] = []; while(d.week[s.id].length<5) d.week[s.id].push(''); }
  });
  return d;
}
function ensureGradeRec(rec){
  if(!rec.perStudent) rec.perStudent = {};
  if(!Array.isArray(rec.parshiot)) rec.parshiot = [];
  while(rec.parshiot.length<5) rec.parshiot.push('');
  if(rec.weekCount!==5) rec.weekCount = 4;
  return rec;
}
function emptyStudentRecord(cls){ return ensureRecordShape({chesarim:'', ichurim:'', yatza:'', cat:{}, week:{}}, cls); }
const gradeKey = (classId, monthId) => classId+'::'+monthId;
function getGradeRecord(classId, monthId){
  const key = gradeKey(classId, monthId);
  if(!st.grades[key]) st.grades[key] = {parshiot:['','','','',''], perStudent:{}, weekCount:4};
  return ensureGradeRec(st.grades[key]);
}
function recFor(classId, monthId){ const r = st.grades[gradeKey(classId, monthId)]; return r ? ensureGradeRec(r) : null; }

function migrateLoadedState(){
  st.classes = Array.isArray(st.classes) ? st.classes : [];
  st.staff = Array.isArray(st.staff) ? st.staff : [];
  st.students = st.students || {};
  st.months = Array.isArray(st.months) ? st.months : [];
  st.grades = st.grades || {};
  st.sheets = st.sheets || {};
  st.reportStatus = st.reportStatus || {};
  // teachers typed on a class become staff
  st.classes.forEach(c=>{
    ensureClassShape(c);
    if(c.teacher && !c.teacherId){
      let s = st.staff.find(x=>x.nameHe===c.teacher || x.nameEn===c.teacher);
      if(!s){ s = {id:uid(), nameEn: isHeb(c.teacher)?'':c.teacher, nameHe: isHeb(c.teacher)?c.teacher:''}; st.staff.push(s); }
      c.teacherId = s.id;
    }
    delete c.teacher;
    if(c.nameHe===undefined){ if(isHeb(c.name)){ c.nameHe = c.name; c.name = ''; } else c.nameHe = ''; }
  });
  Object.keys(st.students).forEach(cid=> (st.students[cid]||[]).forEach(s=>{
    if(s.nameHe===undefined){ if(isHeb(s.name)){ s.nameHe = s.name; s.name = ''; } else s.nameHe = ''; }
  }));
  Object.keys(st.grades).forEach(key=>{
    const rec = ensureGradeRec(st.grades[key]);
    const cls = classById(key.split('::')[0]);
    Object.keys(rec.perStudent).forEach(sid=>{
      rec.perStudent[sid] = migrateStudentRecord(rec.perStudent[sid]);
      if(cls) ensureRecordShape(rec.perStudent[sid], cls);
    });
  });
  st.layout = Object.assign({}, DEFAULT_LAYOUT, st.layout||{});
  st.reportText = Object.assign({}, DEFAULT_REPORT_TEXT, st.reportText||{});
  if(!st.sizes){ st.sizes = Object.assign({}, DEFAULT_SIZES); }
  st.sizes = Object.assign({}, DEFAULT_SIZES, st.sizes);
  delete st.typography; delete st.customFonts; delete st.customFontData;
  st.reportPresets = Array.isArray(st.reportPresets) ? st.reportPresets : [];
  st.printLetterhead = st.printLetterhead!==false;
  st.dashboardThresholds = Object.assign({absences:3, lates:3, low:70, high:85}, st.dashboardThresholds||{});
  st.months.forEach(m=>{
    if(m.year){ m.year = normYear(m.year); return; }
    m.year = monthSchoolYear(m.label) || (m.label===SAMPLE_MONTH_LEGACY ? 'תשפ"ו' : '');
  });
  if(!st.currentYear) st.currentYear = hebYearStr(currentSchoolYearNum());
  st.currentYear = normYear(st.currentYear);
  st.months.forEach(m=>{ if(!m.year) m.year = st.currentYear; });
  ensureYearMonths(st.currentYear);
}

/* ---------------- save status ---------------- */
function setStatus(kind){
  const el = $('saveStatus'); if(!el) return;
  el.classList.remove('saving','error');
  if(kind==='saving'){ el.classList.add('saving'); $('saveText').textContent = 'Saving…'; }
  else if(kind==='error'){ el.classList.add('error'); $('saveText').textContent = 'Not saved'; }
  else if(kind==='view'){ $('saveText').textContent = 'View only'; }
  else $('saveText').textContent = 'Saved';
}

/* =====================================================================
   Audit log, Undo & Redo.
   Each change keeps what it replaced. Undo puts that back and marks the
   row "Undone" (no new row). Redo puts the change back again.
   Only your own changes are listed and can be undone.
   ===================================================================== */
const TRACK = ['classes','staff','students','months','grades','sheets','reportStatus','sizes','layout','reportText','printLetterhead','reportPresets','dashboardThresholds','currentYear'];
const SUBKEYED = new Set(['students','grades','sheets','reportStatus']);
let audit = [];
let snap = null;
let pending = [];
let flushTimer = null;
let persistChain = Promise.resolve();

function trackState(){ const o = {}; TRACK.forEach(k=> o[k] = st[k]); return clone(o); }
function diffPatch(before, after){
  const patch = [];
  TRACK.forEach(k=>{
    const b = before[k], a = after[k];
    if(same(b,a)) return;
    if(SUBKEYED.has(k) && b && a && typeof b==='object' && typeof a==='object'){
      new Set([...Object.keys(b), ...Object.keys(a)]).forEach(sk=>{
        if(!same(b[sk], a[sk])) patch.push({k, sk, had: Object.prototype.hasOwnProperty.call(b, sk), v: clone(b[sk])});
      });
    } else patch.push({k, had: Object.prototype.hasOwnProperty.call(before, k), v: clone(b)});
  });
  return patch;
}
function readPatch(patch){ // current values for the same places
  return patch.map(p=>{
    if(p.sk!==undefined){ const o = st[p.k]||{}; return {k:p.k, sk:p.sk, had:Object.prototype.hasOwnProperty.call(o,p.sk), v:clone(o[p.sk])}; }
    return {k:p.k, had: st[p.k]!==undefined, v:clone(st[p.k])};
  });
}
function applyPatch(patch){
  patch.forEach(p=>{
    if(p.sk!==undefined){
      if(!st[p.k] || typeof st[p.k]!=='object') st[p.k] = {};
      if(p.had) st[p.k][p.sk] = clone(p.v); else delete st[p.k][p.sk];
    } else { if(p.had) st[p.k] = clone(p.v); else delete st[p.k]; }
  });
}
function pruneAudit(){ const cut = Date.now() - AUDIT_DAYS*864e5; audit = audit.filter(e=>e.ts >= cut); }
const mine = e => me && e.user===me.email;
function addAuditEntry(label, patch){
  const now = Date.now();
  // a new change ends the chance to redo older undone changes
  audit.forEach(e=>{ if(mine(e) && e.undone) e.dead = true; });
  const top = audit.find(mine);
  if(top && top.patch && !top.undone && top.action===label.action && top.detail===label.detail && now-(top.lastTs||top.ts) < 90000){
    patch.forEach(p=>{ if(!top.patch.some(q=>q.k===p.k && q.sk===p.sk)) top.patch.push(p); });
    top.lastTs = now; return;
  }
  audit.unshift({id:uid(), ts:now, lastTs:now, user:me.email, action:label.action, detail:label.detail, patch});
}
function logEvent(action, detail){
  audit.unshift({id:uid(), ts:Date.now(), user: me ? me.email : '', action, detail:detail||'', patch:null});
  pruneAudit(); persistAudit(); if(activeTab==='audit') renderAudit();
}
function canEdit(){ return !!me && me.role==='admin'; }
function saveAll(action, detail){
  if(!canEdit()) return;
  if(action) pending.push({action, detail: detail||''});
  setStatus('saving');
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flushNow, 700);
}
function flushNow(){
  clearTimeout(flushTimer); flushTimer = null;
  if(!canEdit() || !snap) return;
  const now = trackState();
  const patch = diffPatch(snap, now);
  if(patch.length){ addAuditEntry(pending[0] || {action:'Edit', detail:''}, patch); pruneAudit(); }
  pending = [];
  snap = now;
  persistState();
  if(activeTab==='audit') renderAudit();
}
function statePayload(){ const o = {schemaVersion:7}; TRACK.forEach(k=> o[k] = st[k]); return clone(o); }
function persistState(){
  const payload = statePayload(), aud = clone(audit);
  persistChain = persistChain.then(async ()=>{ await KV.set('state', payload); await KV.set('audit', aud); setStatus('saved'); })
    .catch(err=>{ console.error(err); setStatus('error'); });
  return persistChain;
}
function persistAudit(){ const aud = clone(audit); persistChain = persistChain.then(()=>KV.set('audit', aud)).catch(()=>{}); }
function persistAssets(){ const a = clone(assets); persistChain = persistChain.then(()=>KV.set('assets', a)).catch(()=>setStatus('error')); }

function undoTarget(){ return audit.find(e=> mine(e) && e.patch && e.patch.length && !e.undone) || null; }
function redoTarget(){ let t = null; audit.forEach(e=>{ if(mine(e) && e.patch && e.undone && !e.dead) t = e; }); return t; }
function afterUndoRedo(){ migrateLoadedState(); snap = trackState(); persistState(); renderActive(); }
function doUndo(){
  flushNow();
  const e = undoTarget(); if(!e) return false;
  e.redoPatch = readPatch(e.patch);
  applyPatch(e.patch);
  e.undone = true;
  afterUndoRedo(); return e;
}
function doRedo(){
  flushNow();
  const e = redoTarget(); if(!e || !e.redoPatch) return false;
  applyPatch(e.redoPatch);
  e.undone = false; delete e.redoPatch;
  afterUndoRedo(); return e;
}
// finish the previous change before a click, choice or Enter starts a new one
['click','change'].forEach(ev=> document.addEventListener(ev, ()=>{ if(pending.length) flushNow(); }, true));
document.addEventListener('keydown', e=>{ if(e.key==='Enter' && pending.length) flushNow(); }, true);
// Ctrl+Z / Ctrl+Y outside text boxes
document.addEventListener('keydown', e=>{
  if(!(e.ctrlKey||e.metaKey) || !canEdit()) return;
  const t = e.target; if(t && (t.tagName==='INPUT' || t.tagName==='TEXTAREA' || t.tagName==='SELECT')) return;
  const k = e.key.toLowerCase();
  if(k==='z' && !e.shiftKey){ e.preventDefault(); if(doUndo()) toast('Undone'); }
  else if(k==='y' || (k==='z' && e.shiftKey)){ e.preventDefault(); if(doRedo()) toast('Redone'); }
});

/* ---------------- toast & modal ---------------- */
let toastTimer = null;
function toast(msg, withUndo){
  $('toastText').textContent = msg;
  $('toastUndo').style.display = withUndo ? '' : 'none';
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, withUndo ? 7000 : 2500);
}
function hideToast(){ $('toast').classList.remove('show'); }
$('toastUndo').addEventListener('click', ()=>{ doUndo(); hideToast(); });
function doneWithUndo(msg){ flushNow(); toast(msg, true); }
function openModal(html, onReady, wide){
  $('modalBox').className = 'modal'+(wide?' wide':'');
  $('modalBox').innerHTML = html;
  $('modal').classList.remove('hidden');
  initEyes($('modalBox'));
  if(onReady) onReady($('modalBox'));
}
function closeModal(){ $('modal').classList.add('hidden'); $('modalBox').innerHTML=''; }
$('modal').addEventListener('mousedown', e=>{ if(e.target.id==='modal') closeModal(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !$('modal').classList.contains('hidden')) closeModal(); });
function askConfirm(title, text, okLabel='Delete', okClass='danger'){
  return new Promise(resolve=>{
    openModal(`<h2>${esc(title)}</h2>${text?`<p>${esc(text)}</p>`:''}<div class="actions"><button class="btn sec" data-a="no">Cancel</button><button class="btn ${okClass}" data-a="yes">${esc(okLabel)}</button></div>`, box=>{
      box.querySelector('[data-a=no]').onclick = ()=>{ closeModal(); resolve(false); };
      box.querySelector('[data-a=yes]').onclick = ()=>{ closeModal(); resolve(true); };
      box.querySelector('[data-a=yes]').focus();
    });
  });
}

/* ---------------- password eye ---------------- */
function paintEye(btn, shown){ btn.innerHTML = shown ? ICON.eyeOff : ICON.eye; btn.setAttribute('aria-label', shown ? 'Hide password' : 'Show password'); }
function initEyes(root){ (root||document).querySelectorAll('.pw-wrap .eye').forEach(b=>{ if(!b.innerHTML) paintEye(b,false); }); }
document.addEventListener('click', e=>{
  const b = e.target.closest('.pw-wrap .eye'); if(!b) return;
  const inp = b.parentElement.querySelector('input'), show = inp.type==='password';
  inp.type = show ? 'text' : 'password'; paintEye(b, show);
});
const pwField = (id, ph, val) => `<div class="pw-wrap"><input type="password" id="${id}" placeholder="${esc(ph||'')}" value="${esc(val||'')}" autocomplete="new-password"><button type="button" class="eye" tabindex="-1"></button></div>`;

/* =====================================================================
   Users (this browser). Real sign-in comes with the cloud version.
   ===================================================================== */
const TEST_MODE = true;   // no password while testing
let users = [], me = null;
const SESSION_KEY = 'gilyon_eval_session';
async function hashPw(pw, salt){
  const data = salt + ':' + pw;
  if(window.crypto && crypto.subtle){ const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
  return 'f'+hashStr(data);
}
async function makeUser(email, role, password){ const salt = uid()+uid(); return {id:uid(), email:email.toLowerCase(), role, active:true, salt, hash: await hashPw(password, salt), created: Date.now()}; }
async function loadUsers(){
  users = (await KV.get('users')) || [];
  if(!users.length){ users = [await makeUser('admin@test.com','admin','test1234'), await makeUser('view@test.com','view','test1234')]; await KV.set('users', users); }
}
function saveUsers(){ const u = clone(users); persistChain = persistChain.then(()=>KV.set('users', u)); }
const activeAdmins = () => users.filter(u=>u.role==='admin' && u.active).length;
async function trySignIn(){
  const email = $('loginEmail').value.trim().toLowerCase(), pw = $('loginPassword').value, msg = $('loginMsg');
  if(!email || !pw){ msg.textContent = 'Enter email and password.'; return; }
  const u = users.find(x=>x.email===email);
  if(!u || u.hash !== await hashPw(pw, u.salt)){ msg.textContent = 'Wrong email or password.'; return; }
  if(!u.active){ msg.textContent = 'This account is disabled. Contact an Admin.'; return; }
  localStorage.setItem(SESSION_KEY, u.id); location.reload();
}
$('signInBtn').addEventListener('click', trySignIn);
['loginEmail','loginPassword'].forEach(id=> $(id).addEventListener('keydown', e=>{ if(e.key==='Enter') trySignIn(); }));
$('signOutBtn').addEventListener('click', ()=>{
  flushNow();
  if(TEST_MODE){ const other = users.find(u=>u.active && u.role!==me.role); if(other) localStorage.setItem(SESSION_KEY, other.id); }
  else localStorage.removeItem(SESSION_KEY);
  persistChain.then(()=>location.reload());
});
window.addEventListener('beforeunload', ()=>{ if(flushTimer) flushNow(); });

/* ---------- students sorted by last name (Hebrew name, else English) ---------- */
function lastKey(s){
  const split = t => String(t||'').trim().split(/\s+/).filter(Boolean);
  const h = split(s.nameHe), e = split(s.name);
  if(h.length) return (h.length>1 ? h[h.length-1]+' '+h.slice(0,-1).join(' ') : h[0]);
  return e.length>1 ? e[e.length-1]+' '+e.slice(0,-1).join(' ') : (e[0]||'');
}
const byLast = (a,b) => lastKey(a).localeCompare(lastKey(b), 'he');
function sortedStudents(classId){ return studentsOf(classId).slice().sort(byLast); }
