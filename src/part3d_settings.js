
/* =====================================================================
   Settings
   ===================================================================== */
function activateSub(sub){
  activeSub = sub;
  document.querySelectorAll('#settingsNav button').forEach(b=>b.classList.toggle('active', b.dataset.sub===sub));
  document.querySelectorAll('.subpanel').forEach(p=>p.classList.toggle('active', p.id==='sub-'+sub));
  if(sub==='importexport') renderImportExport();
  if(sub==='year') renderYear();
  if(sub==='users') renderUsers();
  if(sub==='audit') renderAudit();
}
document.querySelectorAll('#settingsNav button').forEach(b=> b.addEventListener('click', ()=>activateSub(b.dataset.sub)));

/* ---------------- import / export ---------------- */
const normH = h => String(h||'').toLowerCase().replace(/[־\-_]/g,' ').replace(/\s+/g,' ').trim();
const CLASS_H = ['כתה','כיתה','class','class name'].map(normH);
const TEACHER_H = ['שם המלמד','מלמד','teacher','teacher name'].map(normH);
const STUDENT_H = ['שם התלמיד','תלמיד','student','student name'].map(normH);
const ATT_H = {
  chesarim:['חסר','חסרים','absences','absence','absent'].map(normH),
  ichurim:['איחור','איחורים','lates','late'].map(normH),
  yatza:['יצא מוקדם','הלך מיקדום','הלך מוקדם','left early'].map(normH)
};
const SUBJ_ALIASES = {benAdam:['ben adam lachaveiro'], tefila:['תפלה','tefila','tefillah'], hakshava:['הקשבה התמדה','הקשבה והתמדה','listening / effort'], hanhaga:['behavior'], mishnayot:['mishnayot'], chumash:['chumash']};
function matchSubject(cls, base){
  const b = normH(base);
  return cls.subjects.find(s=> normH(s.label)===b || (SUBJ_ALIASES[s.id]||[]).map(normH).includes(b));
}
function pick(row, names){ const k = Object.keys(row).find(h=>names.includes(normH(h))); return k===undefined ? '' : String(row[k]??'').trim(); }

function renderImportExport(){
  const months = sortedMonths();
  fillSelect($('importMonthSelect'), months, m=>m.id, m=>m.label);
  fillSelect($('exportMonthSelect'), months, m=>m.id, m=>m.label);
}
function importRows(rows){
  const monthId = $('importMonthSelect').value;
  const studentsOnly = $('importStudentsOnly').checked;
  const month = st.months.find(m=>m.id===monthId);
  let newClasses = 0, newStudents = 0, scored = 0;
  const unmatched = new Set();
  const fixed = [...CLASS_H, ...TEACHER_H, ...STUDENT_H, ...Object.values(ATT_H).flat()];
  rows.forEach(row=>{
    const cName = pick(row, CLASS_H); if(!cName) return;
    const before = st.classes.length;
    const cls = findOrCreateClass(cName, pick(row, TEACHER_H));
    if(st.classes.length>before) newClasses++;
    const sName = pick(row, STUDENT_H); if(!sName) return;
    const nBefore = (st.students[cls.id]||[]).length;
    const s = findOrCreateStudent(cls.id, sName);
    if(st.students[cls.id].length>nBefore) newStudents++;
    if(studentsOnly || !month) return;
    const rec = getGradeRecord(cls.id, month.id);
    if(!rec.perStudent[s.id]) rec.perStudent[s.id] = emptyStudentRecord(cls);
    const d = ensureRecordShape(rec.perStudent[s.id], cls);
    let any = false;
    Object.keys(row).forEach(h=>{
      const val = String(row[h]??'').trim(), nh = normH(h);
      if(fixed.includes(nh)) {
        for(const [k,names] of Object.entries(ATT_H)) if(names.includes(nh) && val!==''){ d[k] = val; any = true; }
        return;
      }
      if(!nh) return;
      const m = nh.match(/^(.*\S)\s+([1-5])$/);
      if(m){
        const subj = matchSubject(cls, m[1]);
        if(subj && subj.kind==='week'){ if(val!==''){ d.week[subj.id][+m[2]-1] = val; any = true; if(+m[2]===5) rec.weekCount = 5; } return; }
      }
      const subj = matchSubject(cls, h);
      if(subj && subj.kind==='cat'){ if(val!==''){ d.cat[subj.id] = val; any = true; } return; }
      unmatched.add(h);
    });
    if(any) scored++;
  });
  const known = h=>{ const m = normH(h).match(/^(.*\S)\s+([1-5])$/); return st.classes.some(c=> matchSubject(c, h) || (m && matchSubject(c, m[1]))); };
  return {newClasses, newStudents, scored, unmatched:[...unmatched].filter(h=>!known(h)), month};
}
function finishImport(rows, fileName){
  const r = importRows(rows||[]);
  saveAll('Import', fileName);
  flushNow();
  const lines = [`${r.newClasses} new classes · ${r.newStudents} new students`];
  if(r.scored) lines.push(`Scores for ${r.scored} students → ${r.month.label}`);
  if(r.unmatched.length) lines.push('Not matched: '+r.unmatched.join(', '));
  const log = $('importLog'); log.textContent = lines.join('\n'); log.className = 'status-box '+(r.unmatched.length?'error':'good');
  if(r.newClasses || r.newStudents || r.scored) toast('Imported', true);
}
function handleImportFile(file){
  const name = (file.name||'').toLowerCase(), log = $('importLog');
  log.className = 'status-box'; log.textContent = 'Reading…';
  if(name.endsWith('.csv')){
    Papa.parse(file, {header:true, skipEmptyLines:true, complete: res=>finishImport(res.data, file.name), error: err=>{ log.className='status-box error'; log.textContent = err.message; }});
  } else if(/\.xlsx?$/.test(name)){
    const fr = new FileReader();
    fr.onload = ()=>{ try{ const wb = XLSX.read(fr.result, {type:'array'}); finishImport(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:''}), file.name); }catch(err){ log.className='status-box error'; log.textContent = err.message; } };
    fr.readAsArrayBuffer(file);
  } else { log.className='status-box error'; log.textContent = 'CSV, XLSX or XLS only'; }
}
$('importFile').addEventListener('change', e=>{ if(e.target.files[0]) handleImportFile(e.target.files[0]); e.target.value=''; });
const dz = $('dropzone');
['dragenter','dragover'].forEach(ev=> dz.addEventListener(ev, e=>{ e.preventDefault(); dz.classList.add('drag'); }));
['dragleave','drop'].forEach(ev=> dz.addEventListener(ev, e=>{ e.preventDefault(); dz.classList.remove('drag'); }));
dz.addEventListener('drop', e=>{ const f = e.dataTransfer.files[0]; if(f) handleImportFile(f); });

function monthHeaders(monthId){
  const catL = [], weekL = []; let wc = 4;
  st.classes.forEach(c=>{
    ensureClassShape(c);
    c.subjects.forEach(s=>{ const arr = s.kind==='cat' ? catL : weekL; if(!arr.includes(s.label)) arr.push(s.label); });
    const r = recFor(c.id, monthId); if(r && r.weekCount===5) wc = 5;
  });
  const weekCols = []; for(let w=1; w<=wc; w++) weekL.forEach(l=> weekCols.push(l+' '+w));
  return {headers:['כתה','שם המלמד','שם התלמיד','חסר','איחור','יצא מוקדם', ...catL, ...weekCols], wc};
}
function monthRows(monthId){
  const {headers, wc} = monthHeaders(monthId);
  const rows = [];
  st.classes.forEach(cls=>{
    const rec = recFor(cls.id, monthId);
    (st.students[cls.id]||[]).forEach(s=>{
      const d = ensureRecordShape(rec && rec.perStudent[s.id] ? clone(rec.perStudent[s.id]) : emptyStudentRecord(cls), cls);
      const row = {'כתה':cls.name, 'שם המלמד':cls.teacher||'', 'שם התלמיד':s.name, 'חסר':d.chesarim, 'איחור':d.ichurim, 'יצא מוקדם':d.yatza};
      cls.subjects.forEach(sub=>{
        if(sub.kind==='cat') row[sub.label] = d.cat[sub.id]||'';
        else for(let w=1; w<=wc; w++) row[sub.label+' '+w] = (d.week[sub.id]||[])[w-1]||'';
      });
      rows.push(row);
    });
  });
  return {headers, rows};
}
const sheetName = s => (s||'Sheet').replace(/[\\\/\?\*\[\]:]/g,'-').slice(0,31);
function sheetFor(headers, rows){ const ws = XLSX.utils.json_to_sheet(rows, {header:headers}); ws['!cols'] = headers.map(h=>({wch:Math.max(8, String(h).length+2)})); return ws; }
$('exportMonthBtn').addEventListener('click', ()=>{
  const m = st.months.find(x=>x.id===$('exportMonthSelect').value); if(!m) return;
  const {headers, rows} = monthRows(m.id);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, sheetFor(headers, rows), sheetName(m.label));
  XLSX.writeFile(wb, `scores_${m.label}.xlsx`);
});
$('exportYearBtn').addEventListener('click', ()=>{
  const wb = XLSX.utils.book_new();
  sortedMonths().forEach(m=>{ const {headers, rows} = monthRows(m.id); XLSX.utils.book_append_sheet(wb, sheetFor(headers, rows), sheetName(m.label)); });
  XLSX.writeFile(wb, `scores_${st.currentYear}.xlsx`);
});
$('exportRosterBtn').addEventListener('click', ()=>{
  const rows = []; st.classes.forEach(c=> (st.students[c.id]||[]).forEach(s=> rows.push({'כתה':c.name, 'שם המלמד':c.teacher||'', 'שם התלמיד':s.name})));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, sheetFor(['כתה','שם המלמד','שם התלמיד'], rows), 'תלמידים');
  XLSX.writeFile(wb, 'classes_and_students.xlsx');
});
$('downloadTemplateBtn').addEventListener('click', ()=>{
  const m = st.months.find(x=>x.id===$('importMonthSelect').value);
  const {headers} = m ? monthHeaders(m.id) : {headers:['כתה','שם המלמד','שם התלמיד']};
  const rows = [];
  st.classes.forEach(c=> (st.students[c.id]||[]).forEach(s=> rows.push({'כתה':c.name, 'שם המלמד':c.teacher||'', 'שם התלמיד':s.name})));
  if(!rows.length) rows.push({});
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, sheetFor(headers, rows), 'Import');
  XLSX.writeFile(wb, 'import_template.xlsx');
});

/* ---------------- school year ---------------- */
function renderYear(){
  fillSelect($('yearSelect'), schoolYears(), y=>y, y=>y);
  $('yearSelect').value = st.currentYear;
  const last = schoolYears().slice(-1)[0] || st.currentYear;
  $('newYearBtn').textContent = 'Start '+hebYearStr(yearNum(last)+1);
  $('yearMonths').innerHTML = sortedMonths().map(m=>{
    const n = st.classes.filter(c=>{ const r = recFor(c.id, m.id); return r && Object.values(r.perStudent).some(hasAnyScore); }).length;
    return `<div class="month-chip ${n?'has':''}">${esc(m.label)}<small>${n}/${st.classes.length}</small></div>`;
  }).join('');
}
$('yearSelect').addEventListener('change', e=>{ st.currentYear = e.target.value; saveAll('School year', st.currentYear); renderYear(); });
$('newYearBtn').addEventListener('click', async ()=>{
  const last = schoolYears().slice(-1)[0] || st.currentYear;
  const y = hebYearStr(yearNum(last)+1);
  if(!await askConfirm('Start school year '+y+'?', 'Classes and students stay. The dashboard and scores switch to '+y+'.', 'Start')) return;
  ensureYearMonths(y); st.currentYear = y;
  saveAll('Start school year', y); doneWithUndo('School year '+y);
  renderYear();
});

/* ---------------- users ---------------- */
function renderUsers(){
  $('usersBody').innerHTML = users.map(u=>{
    const self = u.id===me.id;
    return `<tr data-uid="${esc(u.id)}">
      <td><strong>${esc(u.email)}</strong>${self?' <span class="tag">you</span>':''}</td>
      <td><select class="role-sel" ${self?'disabled':''}><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option><option value="view" ${u.role==='view'?'selected':''}>View</option></select></td>
      <td><span class="user-status ${u.active?'active':'disabled'}">${u.active?'Active':'Disabled'}</span></td>
      <td style="text-align:right; white-space:nowrap;">${iconBtn('key','Reset password','data-act="pw"')}${self?'':(u.active?iconBtn('ban','Disable','data-act="off"','danger'):iconBtn('check','Enable','data-act="on"'))}</td>
    </tr>`;
  }).join('');
}
$('addUserBtn').addEventListener('click', async ()=>{
  const email = $('newUserEmail').value.trim().toLowerCase(), pw = $('newUserPassword').value, role = $('newUserRole').value;
  const msg = $('userMsg'); msg.className = 'status-box error';
  if(!/^\S+@\S+\.\S+$/.test(email)){ msg.textContent = 'Enter a valid email.'; return; }
  if(users.some(u=>u.email===email)){ msg.textContent = 'That email already has an account.'; return; }
  if(pw.length<6){ msg.textContent = 'Password must be at least 6 characters.'; return; }
  users.push(await makeUser(email, role, pw)); saveUsers();
  logEvent('Add user', email+' · '+role);
  $('newUserEmail').value = ''; $('newUserPassword').value = ''; msg.textContent = '';
  renderUsers(); toast('User added');
});
$('usersBody').addEventListener('change', e=>{
  if(!e.target.classList.contains('role-sel')) return;
  const u = users.find(x=>x.id===e.target.closest('tr').dataset.uid); if(!u) return;
  if(u.role==='admin' && e.target.value!=='admin' && activeAdmins()<=1){ e.target.value = 'admin'; return; }
  u.role = e.target.value; saveUsers(); logEvent('Change role', u.email+' → '+u.role); renderUsers();
});
$('usersBody').addEventListener('click', async e=>{
  const b = e.target.closest('[data-act]'); if(!b) return;
  const u = users.find(x=>x.id===b.closest('tr').dataset.uid); if(!u) return;
  if(b.dataset.act==='off'){
    if(u.role==='admin' && activeAdmins()<=1) return;
    if(!await askConfirm('Disable '+u.email+'?', '', 'Disable')) return;
    u.active = false; saveUsers(); logEvent('Disable user', u.email); renderUsers();
  } else if(b.dataset.act==='on'){
    u.active = true; saveUsers(); logEvent('Enable user', u.email); renderUsers();
  } else if(b.dataset.act==='pw'){
    openModal(`<h2>Reset password</h2><p style="margin-bottom:10px;">${esc(u.email)}</p><div class="fields"><div><label>New password</label>${pwField('rpw1')}</div><div><label>Confirm</label>${pwField('rpw2')}</div></div><div class="msg" id="rpwMsg"></div><div class="actions"><button class="btn secondary" data-a="no">Cancel</button><button class="btn" data-a="yes">Save</button></div>`, box=>{
      initEyes(box); $('rpw1').focus();
      box.querySelector('[data-a=no]').onclick = closeModal;
      box.querySelector('[data-a=yes]').onclick = async ()=>{
        const a = $('rpw1').value, c = $('rpw2').value;
        if(a.length<6){ $('rpwMsg').textContent = 'At least 6 characters.'; return; }
        if(a!==c){ $('rpwMsg').textContent = 'Passwords do not match.'; return; }
        u.salt = uid()+uid(); u.hash = await hashPw(a, u.salt); saveUsers();
        logEvent('Reset password', u.email); closeModal(); toast('Password changed');
      };
    });
  }
});

/* ---------------- audit log ---------------- */
let auditPage = 0;
function fmtTime(ts){ return new Date(ts).toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}); }
function renderAudit(){
  pruneAudit();
  const q = $('auditSearch').value.trim().toLowerCase();
  const rows = audit.filter(e=> !q || [e.user, e.action, e.detail].join(' ').toLowerCase().includes(q));
  $('auditCount').textContent = rows.length;
  const pages = Math.max(1, Math.ceil(rows.length/AUDIT_PAGE));
  if(auditPage >= pages) auditPage = pages-1;
  const undoable = latestUndoable();
  const pageRows = rows.slice(auditPage*AUDIT_PAGE, (auditPage+1)*AUDIT_PAGE);
  $('auditBody').innerHTML = pageRows.length ? pageRows.map(e=>`<tr class="${e.undone?'is-undone':''}">
      <td>${esc(fmtTime(e.ts))}</td>
      <td>${esc(e.user)}</td>
      <td><span class="what">${esc(e.action)}</span>${e.undone?' <span class="tag">Undone</span>':''}</td>
      <td class="detail-cell">${esc(e.detail)}</td>
      <td style="text-align:right;">${undoable && undoable.id===e.id ? `<button class="btn secondary" data-undo="${esc(e.id)}" style="padding:4px 10px;">${ICON.reset} Undo</button>` : ''}</td>
    </tr>`).join('') : '<tr><td colspan="5"><div class="empty-state">No changes in the last 7 days</div></td></tr>';
  $('auditPager').innerHTML = pages>1 ? `<button class="btn secondary" data-pg="-1" ${auditPage===0?'disabled':''}>Previous</button><span>${auditPage+1} / ${pages}</span><button class="btn secondary" data-pg="1" ${auditPage>=pages-1?'disabled':''}>Next</button>` : '';
}
$('auditSearch').addEventListener('input', ()=>{ auditPage = 0; renderAudit(); });
$('auditPager').addEventListener('click', e=>{ const b = e.target.closest('[data-pg]'); if(!b) return; auditPage += Number(b.dataset.pg); renderAudit(); });
$('auditBody').addEventListener('click', e=>{ const b = e.target.closest('[data-undo]'); if(!b) return; if(undoEntry(b.dataset.undo)) toast('Undone'); renderAudit(); });

/* ---------------- backup ---------------- */
$('exportBackupBtn').addEventListener('click', ()=>{
  flushNow();
  const backup = Object.assign(statePayload(), {
    version:6, exportedAt:new Date().toISOString(),
    customFonts: st.customFonts.map(f=>Object.assign({}, f, {dataUrl: assets.customFontData[f.id]||null})),
    letterheadDataUrl: assets.letterheadDataUrl||null
  });
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = `evaluation_backup_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  logEvent('Download backup');
});
$('backupFileInput').addEventListener('change', e=>{
  const file = e.target.files[0]; e.target.value = ''; if(!file) return;
  const fr = new FileReader();
  fr.onload = async ()=>{
    let b; try{ b = JSON.parse(fr.result); }catch(err){ const n = $('backupNote'); n.className='status-box error'; n.textContent = 'Not a valid backup file.'; return; }
    if(!await askConfirm('Restore '+file.name+'?', 'All current data is replaced. You can undo this from the Audit Log.', 'Restore')) return;
    ['classes','students','months','grades','tabMode','typography','layout','reportText','printLetterhead','reportPresets','dashboardThresholds','currentYear'].forEach(k=>{ if(b[k]!==undefined) st[k] = b[k]; });
    st.customFonts = (b.customFonts||[]).map(f=>({id:f.id, label:f.label, format:f.format}));
    (b.customFonts||[]).forEach(f=>{ if(f.dataUrl) assets.customFontData[f.id] = f.dataUrl; });
    if(b.customFontData) Object.assign(assets.customFontData, b.customFontData);
    assets.letterheadDataUrl = b.letterheadDataUrl || null;
    currentLetterheadDataUrl = assets.letterheadDataUrl || DEFAULT_LETTERHEAD_DATAURL;
    migrateLoadedState(); persistAssets(); injectFonts(); applyTypography(); applyLayout();
    saveAll('Restore backup', file.name); doneWithUndo('Backup restored');
    const n = $('backupNote'); n.className='status-box good'; n.textContent = 'Restored '+file.name;
  };
  fr.readAsText(file);
});

/* ---------------- sample data ---------------- */
function rng(seed){ return ()=>{ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed>>>15, 1|seed); t = t + Math.imul(t ^ t>>>7, 61|t) ^ t; return ((t ^ t>>>14)>>>0)/4294967296; }; }
function buildSampleData(){
  const R = rng(5787);
  const y = st.currentYear; ensureYearMonths(y);
  const months = monthsOfYear(y);
  const FIRST = ['משה','דוד','אברהם','יעקב','שלמה','יוסף','חיים','שמואל','אהרן','מנחם','נפתלי','בנימין','יצחק','אליהו','צבי','ישראל','מרדכי','שמחה','פינחס','אשר','עזריאל','מאיר'];
  const LAST = ['גולדברג','ווייס','קליין','שטרן','ברגר','רוזנברג','פרידמן','לאנדאו','הורוויץ','כהן','לוי','שוורץ','גרין','ליכטנשטיין','מאנהייט','אייזנבערג','טננבוים','הלפרין','רובין','פישר','ברלינר','קרימאן'];
  const PAR = {'אלול':['שופטים','כי תצא','כי תבוא','נצבים־וילך'], 'תשרי':['האזינו','בראשית','נח','לך לך'], 'חשוון':['וירא','חיי שרה','תולדות','ויצא']};
  const plan = [
    {name:'א', teacher:'יוסף ברגר', n:11, extra:{label:'כתיבה', kind:'cat'}, base:80},
    {name:'ב', teacher:'ישראל לייפער', n:12, base:88},
    {name:'ג', teacher:'משה גולדשטיין', n:10, extra:{label:'גמרא', kind:'week'}, base:72}
  ];
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));
  plan.forEach(p=>{
    if(st.classes.some(c=>c.name===p.name)) return;
    const cls = findOrCreateClass(p.name, p.teacher); cls.isSample = true;
    if(p.extra) cls.subjects.push({id:uid(), label:p.extra.label, kind:p.extra.kind});
    const used = new Set(), kids = [];
    while(kids.length < p.n){
      const nm = FIRST[Math.floor(R()*FIRST.length)]+' '+LAST[Math.floor(R()*LAST.length)];
      if(used.has(nm)) continue; used.add(nm);
      kids.push({s: findOrCreateStudent(cls.id, nm), skill: clamp(p.base + (R()-0.5)*34, 40, 99), absent: R()<0.25 ? 2 : 0, late: R()<0.25 ? 2 : 0});
    }
    months.forEach((m, mi)=>{
      const mn = monthName(m.label); if(!PAR[mn]) return;
      const rec = getGradeRecord(cls.id, m.id);
      const weeks = mn==='חשוון' ? 1 : 4;
      PAR[mn].forEach((pp,i)=>{ if(i<weeks) rec.parshiot[i] = pp; });
      kids.forEach(k=>{
        const d = rec.perStudent[k.s.id] = emptyStudentRecord(cls);
        const full = weeks===4;
        d.chesarim = String(Math.floor(R()*(2+k.absent)) * (full?1:0) || (full?'0':''));
        d.ichurim = full ? String(Math.floor(R()*(2+k.late))) : '';
        d.yatza = full && R()<0.12 ? '1' : '';
        cls.subjects.forEach(s=>{
          if(s.kind==='cat'){ if(full) d.cat[s.id] = String(clamp(Math.round(k.skill/10 + (R()-0.4)*2), 1, 10)); }
          else for(let w=0; w<weeks; w++){ if(R()<0.05) continue; d.week[s.id][w] = String(clamp(Math.round(k.skill + (R()-0.5)*22), 0, 100)); }
        });
      });
    });
  });
}
$('loadSampleBtn').addEventListener('click', ()=>{
  if(st.classes.some(c=>c.isSample)){ toast('Sample data is already loaded'); return; }
  buildSampleData(); saveAll('Load sample data'); doneWithUndo('Sample data loaded');
});
$('removeSampleBtn').addEventListener('click', async ()=>{
  const legacy = new Set(['ב (לדוגמה)','ג (לדוגמה)']);
  const ids = new Set(st.classes.filter(c=>c.isSample || legacy.has(c.name)).map(c=>c.id));
  if(!ids.size){ toast('No sample data'); return; }
  if(!await askConfirm('Remove sample data?', 'Only the sample classes are removed.', 'Remove')) return;
  st.classes = st.classes.filter(c=>!ids.has(c.id));
  ids.forEach(id=>{ delete st.students[id]; });
  Object.keys(st.grades).forEach(k=>{ if(ids.has(k.split('::')[0])) delete st.grades[k]; });
  const used = new Set(Object.keys(st.grades).map(k=>k.split('::')[1]));
  st.months = st.months.filter(m=> !(m.label===SAMPLE_MONTH_LEGACY && !used.has(m.id)));
  saveAll('Remove sample data'); doneWithUndo('Sample data removed');
});

/* =====================================================================
   Start
   ===================================================================== */
(async function init(){
  initEyes();
  $('gateLogo').src = document.querySelector('.sidebar-logo img').src;
  await loadUsers();
  const sid = localStorage.getItem(SESSION_KEY);
  me = users.find(u=>u.id===sid && u.active) || null;
  if(!me && TEST_MODE){ me = users.find(u=>u.active && u.role==='admin'); localStorage.setItem(SESSION_KEY, me.id); }
  if(!me){ $('gate').classList.remove('hidden'); setTimeout(()=>$('loginEmail').focus(), 50); return; }
  const saved = await KV.get('state');
  if(saved) Object.keys(saved).forEach(k=>{ if(k!=='schemaVersion') st[k] = saved[k]; });
  const a = await KV.get('assets'); if(a) Object.assign(assets, a);
  // older saves kept fonts/letterhead inside the state
  if(st.customFontData){ Object.assign(assets.customFontData, st.customFontData); delete st.customFontData; }
  if(st.letterheadDataUrl){ assets.letterheadDataUrl = st.letterheadDataUrl; delete st.letterheadDataUrl; }
  currentLetterheadDataUrl = assets.letterheadDataUrl || DEFAULT_LETTERHEAD_DATAURL;
  audit = (await KV.get('audit')) || [];
  migrateLoadedState();
  if(!saved) buildSampleData();
  pruneAudit();
  snap = trackState();
  if(!saved) await persistState();
  applyTypography(); applyLayout(); injectFonts();
  $('whoEmail').textContent = me.email;
  $('whoRole').textContent = me.role==='admin' ? 'Admin' : 'View';
  if(TEST_MODE) $('signOutBtn').textContent = me.role==='admin' ? 'Switch to View' : 'Switch to Admin';
  document.body.classList.toggle('view-mode', !canEdit());
  document.querySelectorAll('.admin-only').forEach(el=> el.classList.toggle('role-hidden', !canEdit()));
  setStatus(canEdit() ? 'saved' : 'view');
  activateTab('dashboard');
})();
})();
</script>
</body>
</html>
