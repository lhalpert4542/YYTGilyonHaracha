
/* =====================================================================
   Settings – tabs like the Kriah app
   ===================================================================== */
const SETTINGS_TABS = [['classes','Classes & Staff'],['year','School Year'],['report','Report Setup'],['ai','AI Scanning'],['users','Users'],['data','Backup / Data']];
let settingsTab = 'classes';
function renderSettings(){
  const P = $('panel-settings');
  P.innerHTML = pageHead('Settings') + `<div class="tabs">${SETTINGS_TABS.map(([k,l])=>`<button data-st="${k}" class="${k===settingsTab?'on':''}">${l}</button>`).join('')}</div><div id="stBody"></div>`;
  P.querySelectorAll('[data-st]').forEach(b=> b.onclick = ()=>{ flushNow(); settingsTab = b.dataset.st; renderSettings(); });
  ({year:renderYearTab, classes:renderClassesStaffTab, report:()=>renderReportSetup($('stBody')), ai:renderAiTab, users:renderUsersTab, data:renderDataTab}[settingsTab])();
}

/* ---------- School Year ---------- */
function renderYearTab(){
  const box = $('stBody'), last = schoolYears().slice(-1)[0] || st.currentYear, next = hebYearStr(yearNum(last)+1);
  box.innerHTML = `<div class="card"><div class="card-head"><h2>Current school year</h2><select id="yearSel" dir="rtl">${options(schoolYears(), y=>y, y=>y, st.currentYear)}</select><span class="sp"></span><button class="btn" id="newYear">Start ${esc(next)}</button></div>
    <table class="t"><thead><tr><th>Month</th><th>Classes with scores</th><th>Assessments</th><th>Scanned</th></tr></thead><tbody>${sortedMonths().map(m=>{
      const cl = st.classes.filter(c=>studentsOf(c.id).length);
      const sc = cl.filter(c=>monthHasScores(c.id, m.id)).length, sh = cl.filter(c=>st.sheets[gradeKey(c.id,m.id)]).length, sn = cl.filter(c=>sheetState(c, m.id)==='scanned').length;
      return `<tr><td>${he(m.label)}</td><td>${sc}/${cl.length}</td><td>${sh}/${cl.length}</td><td>${sn}/${cl.length}</td></tr>`; }).join('')}</tbody></table></div>`;
  $('yearSel').onchange = e=>{ st.currentYear = e.target.value; saveAll('School year', st.currentYear); renderYearTab(); };
  $('newYear').onclick = async ()=>{
    if(!await askConfirm('Start school year '+next+'?', 'Classes, staff and students stay. Dashboard, scores, assessments and reports switch to '+next+'.', 'Start', '')) return;
    ensureYearMonths(next); st.currentYear = next; saveAll('Start school year', next); doneWithUndo('School year '+next); renderYearTab();
  };
}

/* ---------- Classes & Staff (one tab) ---------- */
let csClassId = '';
const staffLabel = s => (s.nameEn||s.nameHe||'') + (s.nameEn && s.nameHe ? ' · '+s.nameHe : '');
function renderClassesStaffTab(){
  const box = $('stBody');
  if(!classById(csClassId)) csClassId = st.classes[0] ? st.classes[0].id : '';
  box.innerHTML = `<div class="cs-grid">
    <div class="card"><div class="card-head"><h2>Classes</h2><span class="pill">${st.classes.length}</span></div>
      <div class="row" style="margin-bottom:12px;"><input type="text" id="ncEn" placeholder="Class (English)" style="flex:1 1 120px;"><input type="text" id="ncHe" dir="rtl" placeholder="כתה" style="flex:1 1 90px;">
        <select id="ncT" style="flex:1 1 150px;"><option value="">Teacher</option>${options(st.staff, s=>s.id, staffLabel, '')}</select><button class="btn" id="ncAdd">${ICON.plus}Add</button></div>
      ${st.classes.length ? `<table class="t"><thead><tr><th style="width:22%;">Class</th><th style="width:16%;">Hebrew name</th><th>Teacher</th><th style="width:1%;">Students</th><th style="width:1%;"></th></tr></thead><tbody>${st.classes.map(c=>`<tr data-cid="${esc(c.id)}" class="click ${c.id===csClassId?'sel':''}">
        <td><input type="text" data-f="name" value="${esc(c.name||'')}"></td><td><input type="text" dir="rtl" data-f="nameHe" value="${esc(c.nameHe||'')}"></td>
        <td><select data-f="teacherId"><option value="">—</option>${options(st.staff, s=>s.id, staffLabel, c.teacherId)}</select></td>
        <td style="text-align:center;">${studentsOf(c.id).length}</td><td class="act">${iconBtn('trash','Delete class','data-del','danger')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No classes yet</div>'}
    </div>
    <div class="card" id="subjCard"></div>
  </div>
  <div class="card"><div class="card-head"><h2>Staff</h2><span class="pill">${st.staff.length}</span></div>
    <div class="row" style="margin-bottom:12px;"><input type="text" id="nsEn" placeholder="English name" style="flex:1 1 200px;"><input type="text" id="nsHe" dir="rtl" placeholder="שם בעברית" style="flex:1 1 200px;"><button class="btn" id="nsAdd">${ICON.plus}Add</button></div>
    ${st.staff.length ? `<table class="t"><thead><tr><th>Name</th><th>Hebrew name</th><th>Classes</th><th></th></tr></thead><tbody>${st.staff.map(s=>`<tr data-id="${esc(s.id)}">
      <td><input type="text" data-f="nameEn" value="${esc(s.nameEn||'')}"></td><td><input type="text" dir="rtl" data-f="nameHe" value="${esc(s.nameHe||'')}"></td>
      <td>${st.classes.filter(c=>c.teacherId===s.id).map(c=>esc(classLabel(c))).join(', ') || '<span class="muted">—</span>'}</td>
      <td class="act">${iconBtn('trash','Remove','data-del','danger')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No staff yet</div>'}
  </div>`;
  // classes
  const addClass = ()=>{
    const en = $('ncEn').value.trim(), h = $('ncHe').value.trim(); if(!en && !h){ $('ncEn').focus(); return; }
    if(st.classes.some(c=>(en && c.name===en) || (h && c.nameHe===h))){ toast('That class already exists'); return; }
    const c = {id:uid(), name:en, nameHe:h, teacherId:$('ncT').value, subjects:defaultSubjects()};
    st.classes.push(c); csClassId = c.id;
    saveAll('Add class', en||h); renderClassesStaffTab(); $('ncEn').focus();
  };
  $('ncAdd').onclick = addClass; ['ncEn','ncHe'].forEach(id=> $(id).addEventListener('keydown', e=>{ if(e.key==='Enter') addClass(); }));
  box.querySelectorAll('tr[data-cid]').forEach(tr=>{
    const c = classById(tr.dataset.cid);
    tr.addEventListener('click', e=>{ if(e.target.closest('[data-del]')) return; if(csClassId!==c.id){ csClassId = c.id; box.querySelectorAll('tr[data-cid]').forEach(x=>x.classList.toggle('sel', x===tr)); renderSubjCard(); } });
    tr.querySelectorAll('[data-f]').forEach(inp=> inp.addEventListener('change', ()=>{ c[inp.dataset.f] = inp.value.trim(); saveAll('Edit class', enName(c)); renderSubjCard(); }));
    tr.querySelector('[data-del]').onclick = async ()=>{
      if(!await askConfirm('Delete class '+enName(c)+'?', 'Its students, scores, sheets and report status are removed.')) return;
      st.classes = st.classes.filter(x=>x.id!==c.id); delete st.students[c.id];
      ['grades','sheets','reportStatus'].forEach(k=> Object.keys(st[k]).forEach(key=>{ if(key.startsWith(c.id+'::')) delete st[k][key]; }));
      saveAll('Delete class', enName(c)); doneWithUndo('Class deleted'); renderClassesStaffTab();
    };
  });
  // staff
  const addStaff = ()=>{ const en = $('nsEn').value.trim(), h = $('nsHe').value.trim(); if(!en && !h){ $('nsEn').focus(); return; } st.staff.push({id:uid(), nameEn:en, nameHe:h}); saveAll('Add staff', h||en); renderClassesStaffTab(); $('nsEn').focus(); };
  $('nsAdd').onclick = addStaff; ['nsEn','nsHe'].forEach(id=> $(id).addEventListener('keydown', e=>{ if(e.key==='Enter') addStaff(); }));
  box.querySelectorAll('tr[data-id]').forEach(tr=>{
    const s = staffById(tr.dataset.id);
    tr.querySelectorAll('[data-f]').forEach(inp=> inp.addEventListener('change', ()=>{ s[inp.dataset.f] = inp.value.trim(); saveAll('Edit staff', s.nameHe||s.nameEn); }));
    tr.querySelector('[data-del]').onclick = async ()=>{
      if(!await askConfirm('Remove '+(s.nameEn||s.nameHe)+'?', 'Their classes will have no teacher.', 'Remove')) return;
      st.staff = st.staff.filter(x=>x.id!==s.id); st.classes.forEach(c=>{ if(c.teacherId===s.id) c.teacherId = ''; });
      saveAll('Remove staff', s.nameHe||s.nameEn); doneWithUndo('Removed'); renderClassesStaffTab();
    };
  });
  renderSubjCard();
}
function renderSubjCard(){
  const card = $('subjCard'); if(!card) return;
  const cls = classById(csClassId);
  if(!cls){ card.innerHTML = '<h2>Subjects</h2><div class="empty">Add a class first</div>'; return; }
  card.innerHTML = `<div class="card-head"><h2>Subjects · ${esc(classLabel(cls))}</h2><span class="sp"></span>${iconBtn('undo','Default subjects','id="sjReset"')}<button class="btn sec sm" id="sjCopy">Copy to all classes</button></div>
    <div class="fail-set">Weekly scores below <input type="number" id="failBelow" min="0" max="100" value="${esc(st.failBelow ?? '')}"> show <b class="he">${esc(st.reportText.failText||'לא הצליח')}</b> on reports <span class="muted small">· all classes</span></div>
    <div class="row" style="margin-bottom:12px;"><input type="text" id="sjNew" dir="rtl" placeholder="מקצוע" style="flex:1 1 140px;"><select id="sjKind"><option value="week">Weekly (0–100)</option><option value="cat">Monthly (1–10)</option></select><button class="btn" id="sjAdd">${ICON.plus}Add</button></div>
    <table class="t"><thead><tr><th>Subject</th><th style="width:1%;">Type</th><th></th></tr></thead><tbody>${cls.subjects.map(s=>`<tr data-id="${esc(s.id)}"><td style="min-width:120px;"><input type="text" dir="rtl" data-f="label" value="${esc(s.label)}"></td>
      <td><select data-f="kind" style="width:132px;"><option value="week" ${s.kind==='week'?'selected':''}>Weekly (0–100)</option><option value="cat" ${s.kind==='cat'?'selected':''}>Monthly (1–10)</option></select></td>
      <td class="act">${iconBtn('trash','Remove','data-del','danger')}</td></tr>`).join('')}</tbody></table>`;
  const add = ()=>{ const v = $('sjNew').value.trim(); if(!v){ $('sjNew').focus(); return; } if(cls.subjects.some(s=>s.label===v)){ toast('Already there'); return; } cls.subjects.push({id:uid(), label:v, kind:$('sjKind').value}); saveAll('Add subject', v+' · '+enName(cls)); renderSubjCard(); $('sjNew').focus(); };
  $('failBelow').onchange = e=>{ const v = e.target.value.trim(); st.failBelow = v==='' ? '' : Math.max(0, Math.min(100, Number(v)||0)); e.target.value = st.failBelow; saveAll('Report limit', v===''?'off':String(st.failBelow)); };
  $('sjAdd').onclick = add; $('sjNew').addEventListener('keydown', e=>{ if(e.key==='Enter') add(); });
  $('sjReset').onclick = async ()=>{ if(!await askConfirm('Reset subjects for '+enName(cls)+'?', '', 'Reset', '')) return; cls.subjects = defaultSubjects(); saveAll('Reset subjects', enName(cls)); doneWithUndo('Subjects reset'); renderSubjCard(); };
  $('sjCopy').onclick = async ()=>{ if(!await askConfirm('Copy these subjects to every class?', 'Each class gets this same list.', 'Copy', '')) return; st.classes.forEach(c=>{ if(c!==cls) c.subjects = clone(cls.subjects); }); saveAll('Copy subjects to all classes', enName(cls)); doneWithUndo('Subjects copied'); };
  card.querySelectorAll('tr[data-id]').forEach(tr=>{
    const s = cls.subjects.find(x=>x.id===tr.dataset.id);
    tr.querySelectorAll('[data-f]').forEach(inp=> inp.addEventListener('change', ()=>{
      const f = inp.dataset.f, v = inp.value.trim();
      if(!v) return;
      s[f] = v; saveAll('Edit subject', s.label+' · '+enName(cls)); if(f==='kind') renderSubjCard();
    }));
    tr.querySelector('[data-del]').onclick = async ()=>{ if(cls.subjects.length<=1) return; if(!await askConfirm('Remove '+s.label+'?', '', 'Remove')) return; cls.subjects = cls.subjects.filter(x=>x.id!==s.id); saveAll('Remove subject', s.label+' · '+enName(cls)); doneWithUndo('Subject removed'); renderSubjCard(); };
  });
}

/* ---------- AI Scanning ---------- */
function renderAiTab(){
  const box = $('stBody'), key = aiKey();
  box.innerHTML = `<div class="card" style="max-width:640px;"><h2>Claude API key</h2>
    ${key ? `<div class="notice">Key saved${CLOUD?'':' in this browser'} · ends in <b>${esc(key.slice(-4))}</b></div>` : ''}
    <div class="row nowrap">${pwField('aiKeyIn', key ? 'Paste a new key to replace it' : 'sk-ant-…')}<button class="btn" id="aiSave">Save</button>${key?`<button class="btn sec" id="aiRemove">Remove</button>`:''}</div>
    <div class="row" style="margin-top:14px;"><label>Model</label><select id="aiModel"><option value="claude-opus-5-5">Claude Opus 5.5 – most accurate</option><option value="claude-sonnet-5-5">Claude Sonnet 5.5 – lower cost</option></select>
      <span class="sp" style="flex:1;"></span><button class="btn sec" id="aiTest" ${key?'':'disabled'}>Test</button></div>
    <div id="aiMsg" class="small" style="margin-top:10px;"></div></div>`;
  initEyes(box);
  $('aiModel').value = aiModel();
  $('aiModel').onchange = e=>{ if(CLOUD){ secrets.model = e.target.value; saveSecretsCloud(); } else { try{ localStorage.setItem('gh:ai-model', e.target.value); }catch(err){} } logEvent('Scan model', e.target.value); };
  $('aiSave').onclick = async ()=>{ const v = $('aiKeyIn').value.trim(); if(!v){ $('aiKeyIn').focus(); return; } if(CLOUD){ secrets.key = v; await saveSecretsCloud(); } else { try{ localStorage.setItem('gh:ai-key', v); }catch(err){} } logEvent('API key saved'); toast('API key saved'); renderAiTab(); };
  if($('aiRemove')) $('aiRemove').onclick = async ()=>{ if(!await askConfirm('Remove the API key?', 'Scanning stops working until a key is added.', 'Remove')) return; if(CLOUD){ delete secrets.key; await saveSecretsCloud(); } else { try{ localStorage.removeItem('gh:ai-key'); }catch(err){} } logEvent('API key removed'); renderAiTab(); };
  $('aiTest').onclick = async ()=>{
    const msg = $('aiMsg'); msg.textContent = 'Testing…'; msg.style.color = '';
    try{ await aiCall([{type:'text', text:'Reply with the word OK.'}], 10); msg.textContent = 'The key works.'; msg.style.color = 'var(--good)'; }
    catch(err){ msg.textContent = err.message; msg.style.color = 'var(--bad)'; }
  };
}

/* ---------- Users ---------- */
async function userAction(fn, okMsg){
  try{ await fn(); if(CLOUD) await loadUsersCloud(); else saveUsers(); renderUsersTab(); if(okMsg) toast(okMsg); }
  catch(e){ toast(e.message || String(e)); }
}
function renderUsersTab(){
  const box = $('stBody');
  box.innerHTML = `<div class="card"><div class="row"><input type="email" id="nuEmail" placeholder="Email" style="flex:1 1 220px;"><select id="nuRole"><option value="view">View</option><option value="admin">Admin</option></select>
    <div style="flex:1 1 180px;">${pwField('nuPw','Password')}</div><button class="btn" id="nuAdd">${ICON.plus}Add</button></div><div id="nuMsg" class="small" style="color:var(--bad);margin-top:6px;"></div></div>
    <div class="card"><table class="t"><thead><tr><th>Email</th><th>Role</th><th>Status</th>${CLOUD?'<th>Last sign-in</th>':''}<th></th></tr></thead><tbody>${users.map(u=>{ const self = u.email===me.email; return `<tr data-uid="${esc(u.id)}">
      <td><b>${esc(u.email)}</b>${self?' <span class="tag">you</span>':''}</td>
      <td><select class="role-sel" ${self?'disabled':''}><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option><option value="view" ${u.role==='view'?'selected':''}>View</option></select></td>
      <td><span class="tag ${u.active?'ok':''}">${u.active?'Active':'Disabled'}</span></td>${CLOUD?`<td class="small muted">${u.lastLogin?esc(fmtTime(Date.parse(u.lastLogin))):'—'}</td>`:''}
      <td class="act">${iconBtn('key','Set password','data-act="pw"')}${self?'':(u.active?iconBtn('ban','Disable','data-act="off"','danger'):iconBtn('check','Enable','data-act="on"'))}</td></tr>`; }).join('')}</tbody></table></div>`;
  initEyes(box);
  $('nuAdd').onclick = async ()=>{
    const email = $('nuEmail').value.trim().toLowerCase(), pw = $('nuPw').value, role = $('nuRole').value, msg = $('nuMsg');
    if(!/^\S+@\S+\.\S+$/.test(email)){ msg.textContent = 'Enter a valid email.'; return; }
    if(users.some(u=>u.email===email)){ msg.textContent = 'That email already has an account.'; return; }
    if(pw.length<6){ msg.textContent = 'Password must be at least 6 characters.'; return; }
    msg.textContent = '';
    await userAction(async ()=>{
      if(CLOUD) sbErr(await SB.rpc('gilyon_admin_create_user', {new_email:email, new_password:pw, new_role:role}));
      else users.push(await makeUser(email, role, pw));
      logEvent('Add user', email+' · '+role);
    }, 'User added');
  };
  box.querySelectorAll('.role-sel').forEach(sel=> sel.onchange = ()=>{
    const u = users.find(x=>x.id===sel.closest('tr').dataset.uid);
    if(u.role==='admin' && sel.value!=='admin' && activeAdmins()<=1){ sel.value = 'admin'; toast('Keep at least one Admin'); return; }
    const role = sel.value;
    userAction(async ()=>{ if(CLOUD) sbErr(await SB.from('gilyon_users').update({role}).eq('id', u.id)); else u.role = role; logEvent('Change role', u.email+' → '+role); });
  });
  box.querySelectorAll('[data-act]').forEach(b=> b.onclick = async ()=>{
    const u = users.find(x=>x.id===b.closest('tr').dataset.uid);
    const setActive = on => userAction(async ()=>{ if(CLOUD) sbErr(await SB.from('gilyon_users').update({active:on}).eq('id', u.id)); else u.active = on; logEvent(on?'Enable user':'Disable user', u.email); });
    if(b.dataset.act==='off'){ if(u.role==='admin' && activeAdmins()<=1) return; if(!await askConfirm('Disable '+u.email+'?', 'They will not be able to sign in.', 'Disable')) return; setActive(false); }
    else if(b.dataset.act==='on') setActive(true);
    else openModal(`<h2>Set password</h2><p style="margin-bottom:10px;">${esc(u.email)}</p><div class="fl"><div><label>New password</label>${pwField('rp1')}</div><div><label>Confirm</label>${pwField('rp2')}</div></div><div class="msg" id="rpMsg"></div><div class="actions"><button class="btn sec" data-a="no">Cancel</button><button class="btn" data-a="yes">Save</button></div>`, mb=>{
      $('rp1').focus(); mb.querySelector('[data-a=no]').onclick = closeModal;
      mb.querySelector('[data-a=yes]').onclick = async ()=>{
        const a = $('rp1').value, c = $('rp2').value;
        if(a.length<6){ $('rpMsg').textContent = 'At least 6 characters.'; return; }
        if(a!==c){ $('rpMsg').textContent = 'Passwords do not match.'; return; }
        try{
          if(CLOUD) sbErr(await SB.rpc('gilyon_admin_set_password', {target_email:u.email, new_password:a}));
          else { u.salt = uid()+uid(); u.hash = await hashPw(a, u.salt); saveUsers(); }
          logEvent('Set password', u.email); closeModal(); toast('Password changed');
        }catch(e){ $('rpMsg').textContent = e.message; }
      };
    });
  });
}

/* ---------- Backup / Data ---------- */
const normH = h => String(h||'').toLowerCase().replace(/[־\-_]/g,' ').replace(/\s+/g,' ').trim();
const H = {
  clsEn:['class','class name'], clsHe:['כתה','כיתה'], tEn:['teacher','teacher name'], tHe:['מלמד','שם המלמד'],
  sEn:['student','student name','name','english name'], sHe:['שם התלמיד','תלמיד','שם'],
  chesarim:['חסר','חסרים','absent','absences'], ichurim:['איחור','איחורים','late','lates'], yatza:['יצא מוקדם','left early']
};
Object.keys(H).forEach(k=> H[k] = H[k].map(normH));
const SUBJ_ALIASES = {benAdam:['ben adam lachaveiro'], tefila:['תפלה','tefila','tefillah'], hakshava:['הקשבה התמדה','הקשבה והתמדה'], hanhaga:['behavior'], mishnayot:['mishnayot'], chumash:['chumash']};
function matchSubject(cls, base){ const b = normH(base); return cls.subjects.find(s=> normH(s.label)===b || (SUBJ_ALIASES[s.id]||[]).map(normH).includes(b)); }
function pick(row, names){ const k = Object.keys(row).find(h=>names.includes(normH(h))); return k===undefined ? '' : String(row[k]??'').trim(); }
function importRows(rows, monthId, studentsOnly){
  const month = monthById(monthId);
  let newClasses = 0, newStudents = 0, scored = 0; const unmatched = new Set();
  const fixed = [].concat(...Object.values(H));
  rows.forEach(row=>{
    const cEn = pick(row, H.clsEn), cHe = pick(row, H.clsHe); if(!cEn && !cHe) return;
    const before = st.classes.length, cls = findOrCreateClass(cEn, cHe); if(st.classes.length>before) newClasses++;
    const tEn = pick(row, H.tEn), tHe = pick(row, H.tHe);
    if((tEn || tHe) && !cls.teacherId){ const t = findOrCreateStaff(tEn, tHe); if(t) cls.teacherId = t.id; }
    const sEn = pick(row, H.sEn), sHe = pick(row, H.sHe); if(!sEn && !sHe) return;
    const nb = studentsOf(cls.id).length, s = findOrCreateStudent(cls.id, sEn, sHe); if(studentsOf(cls.id).length>nb) newStudents++;
    if(studentsOnly || !month) return;
    const rec = getGradeRecord(cls.id, month.id);
    if(!rec.perStudent[s.id]) rec.perStudent[s.id] = emptyStudentRecord(cls);
    const d = ensureRecordShape(rec.perStudent[s.id], cls);
    let any = false;
    Object.keys(row).forEach(h=>{
      const val = String(row[h]??'').trim(), nh = normH(h); if(!nh) return;
      if(fixed.includes(nh)){ ['chesarim','ichurim','yatza'].forEach(k=>{ if(H[k].includes(nh) && val!==''){ d[k] = val; any = true; } }); return; }
      const m = nh.match(/^(.*\S)\s+([1-5])$/);
      if(m){ const sj = matchSubject(cls, m[1]); if(sj && sj.kind==='week'){ if(val!==''){ d.week[sj.id][+m[2]-1] = val; any = true; if(+m[2]===5) rec.weekCount = 5; } return; } }
      const sj = matchSubject(cls, h);
      if(sj && sj.kind==='cat'){ if(val!==''){ d.cat[sj.id] = val; any = true; } return; }
      unmatched.add(h);
    });
    if(any) scored++;
  });
  const known = h=>{ const m = normH(h).match(/^(.*\S)\s+([1-5])$/); return st.classes.some(c=> matchSubject(c, h) || (m && matchSubject(c, m[1]))); };
  return {newClasses, newStudents, scored, unmatched:[...unmatched].filter(h=>!known(h)), month};
}
function monthHeaders(monthId){
  const catL = [], weekL = []; let wc = 4;
  st.classes.forEach(c=>{ c.subjects.forEach(s=>{ const arr = s.kind==='cat' ? catL : weekL; if(!arr.includes(s.label)) arr.push(s.label); }); const r = recFor(c.id, monthId); if(r && r.weekCount===5) wc = 5; });
  const weekCols = []; for(let w=1; w<=wc; w++) weekL.forEach(l=> weekCols.push(l+' '+w));
  return {headers:['Class','כתה','Teacher','מלמד','Student','שם התלמיד','חסר','איחור','יצא מוקדם', ...catL, ...weekCols], wc};
}
function baseRow(c, s){ const t = teacherOf(c); return {'Class':c.name||'', 'כתה':c.nameHe||'', 'Teacher':t?t.nameEn||'':'', 'מלמד':t?t.nameHe||'':'', 'Student':s?s.name||'':'', 'שם התלמיד':s?s.nameHe||'':''}; }
function monthRows(monthId){
  const {headers, wc} = monthHeaders(monthId), rows = [];
  st.classes.forEach(cls=>{ const rec = recFor(cls.id, monthId); studentsOf(cls.id).forEach(s=>{
    const d = ensureRecordShape(rec && rec.perStudent[s.id] ? clone(rec.perStudent[s.id]) : emptyStudentRecord(cls), cls);
    const row = Object.assign(baseRow(cls, s), {'חסר':d.chesarim, 'איחור':d.ichurim, 'יצא מוקדם':d.yatza});
    cls.subjects.forEach(sub=>{ if(sub.kind==='cat') row[sub.label] = d.cat[sub.id]||''; else for(let w=1; w<=wc; w++) row[sub.label+' '+w] = (d.week[sub.id]||[])[w-1]||''; });
    rows.push(row);
  }); });
  return {headers, rows};
}
const sheetName = s => (s||'Sheet').replace(/[\\\/\?\*\[\]:]/g,'-').slice(0,31);
function classMonthTable(c, monthId){
  const rec = recFor(c.id, monthId), wc = rec ? rec.weekCount : 4;
  const cat = c.subjects.filter(s=>s.kind==='cat'), wk = c.subjects.filter(s=>s.kind==='week');
  const headers = ['English name','שם התלמיד','חסר','איחור','יצא מוקדם', ...cat.map(s=>s.label)];
  for(let w=1; w<=wc; w++) wk.forEach(s=> headers.push(s.label+' '+w));
  const num = v => (v!=='' && v!=null && !isNaN(Number(v))) ? Number(v) : (v==null ? '' : v);
  const rows = sortedStudents(c.id).map(s=>{
    const d = ensureRecordShape(rec && rec.perStudent[s.id] ? clone(rec.perStudent[s.id]) : emptyStudentRecord(c), c);
    const row = {'English name':s.name||'', 'שם התלמיד':s.nameHe||'', 'חסר':num(d.chesarim), 'איחור':num(d.ichurim), 'יצא מוקדם':num(d.yatza)};
    cat.forEach(sj=> row[sj.label] = num(d.cat[sj.id]));
    for(let w=1; w<=wc; w++) wk.forEach(sj=> row[sj.label+' '+w] = num((d.week[sj.id]||[])[w-1]));
    return row;
  });
  return {headers, rows};
}
function exportWorkbook(file, tableFor){
  const wb = XLSX.utils.book_new(), used = new Set(); let nRows = 0, nVals = 0;
  st.classes.forEach(c=>{
    const {headers, rows} = tableFor(c);
    nRows += rows.length; rows.forEach(r=> Object.entries(r).forEach(([k,v])=>{ if(!['English name','שם התלמיד','חודש'].includes(k) && v!=='' && v!=null) nVals++; }));
    let name = sheetName(classLabel(c)), i = 2; while(used.has(name)) name = sheetName(classLabel(c)).slice(0,28)+' '+(i++); used.add(name);
    const ws = xlsSheet(headers, rows); ws['!views'] = [{RTL:true}];
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  if(!wb.SheetNames.length){ toast('No classes'); return; }
  wb.Workbook = {Views:[{RTL:true}]};
  XLSX.writeFile(wb, file);
  toast(nRows ? `Excel downloaded · ${nRows} students${/^scores/.test(file) && !nVals ? ' · no scores entered for this month yet' : ''}` : 'Excel downloaded · no students yet');
}
function xlsSheet(headers, rows){ const ws = XLSX.utils.json_to_sheet(rows, {header:headers}); ws['!cols'] = headers.map(h=>({wch:Math.max(9, String(h).length+2)})); return ws; }
function renderDataTab(){
  const box = $('stBody'), months = sortedMonths();
  const mOpts = options(months, m=>m.id, m=>m.label, (months.find(m=>st.classes.some(c=>monthHasScores(c.id,m.id)))||{}).id);
  box.innerHTML = `<div class="dash-grid">
    <div class="card"><div class="card-head"><h2>Import from Excel</h2><span class="sp"></span><button class="btn sec sm" id="tplBtn">Template</button></div>
      <div class="row" style="margin-bottom:10px;"><label>Scores month</label><select id="impMonth" dir="rtl">${mOpts}</select><label style="display:flex;gap:5px;align-items:center;"><input type="checkbox" id="impOnly"> Classes &amp; students only</label></div>
      <label class="empty" for="impFile" id="dropzone" style="display:block;cursor:pointer;">Drop Excel / CSV here or click to choose</label><input type="file" id="impFile" accept=".csv,.xlsx,.xls" style="display:none;">
      <div id="impLog" class="small" style="margin-top:8px;white-space:pre-line;"></div></div>
    <div class="card"><h2>Download Excel</h2><div class="small muted" style="margin-bottom:10px;">One sheet per class</div><div class="row"><select id="expMonth" dir="rtl">${mOpts}</select><button class="btn" id="expMonthBtn">${ICON.download}Month</button><button class="btn sec" id="expYearBtn">${ICON.download}Whole year</button><button class="btn sec" id="expRosterBtn">${ICON.download}Classes &amp; students</button></div></div>
    <div class="card"><h2>Full Backup</h2><div class="row"><button class="btn" id="bkDown">Download backup</button><label class="btn sec" for="bkFile" style="cursor:pointer;">Restore backup</label><input type="file" id="bkFile" accept=".json" style="display:none;"></div><div id="bkMsg" class="small" style="margin-top:8px;"></div></div>
    <div class="card"><h2>Sample Data</h2><div class="row"><button class="btn sec" id="smLoad">Load sample data</button><button class="btn danger" id="smRemove">Remove sample data</button></div></div></div>`;
  const log = (t, bad)=>{ const l = $('impLog'); l.textContent = t; l.style.color = bad ? 'var(--bad)' : 'var(--good)'; };
  const finish = (rows, name)=>{
    const r = importRows(rows||[], $('impMonth').value, $('impOnly').checked);
    saveAll('Import', name); flushNow();
    const lines = [`${r.newClasses} new classes · ${r.newStudents} new students`]; if(r.scored) lines.push(`Scores for ${r.scored} students → ${r.month.label}`); if(r.unmatched.length) lines.push('Not matched: '+r.unmatched.join(', '));
    log(lines.join('\n'), r.unmatched.length); if(r.newClasses || r.newStudents || r.scored) toast('Imported', true);
  };
  const handle = f=>{
    const n = (f.name||'').toLowerCase(); log('Reading…');
    if(n.endsWith('.csv')) Papa.parse(f, {header:true, skipEmptyLines:true, complete:res=>finish(res.data, f.name), error:e=>log(e.message, true)});
    else if(/\.xlsx?$/.test(n)){ const fr = new FileReader(); fr.onload = ()=>{ try{
      const wb = XLSX.read(fr.result, {type:'array'}), all = [];
      wb.SheetNames.forEach(sn=>{
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], {defval:''});
        const cls = st.classes.find(c=> sheetName(classLabel(c))===sn || c.name===sn || c.nameHe===sn);
        rows.forEach(r=>{ if(!pick(r, H.clsEn) && !pick(r, H.clsHe)){ if(cls){ r['Class'] = cls.name; r['כתה'] = cls.nameHe; } else r['Class'] = sn; } all.push(r); });
      });
      finish(all, f.name); }catch(e){ log(e.message, true); } }; fr.readAsArrayBuffer(f); }
    else log('CSV, XLSX or XLS only', true);
  };
  $('impFile').onchange = e=>{ if(e.target.files[0]) handle(e.target.files[0]); e.target.value = ''; };
  const dz = $('dropzone');
  ['dragenter','dragover'].forEach(ev=> dz.addEventListener(ev, e=>{ e.preventDefault(); dz.style.borderColor = 'var(--accent)'; }));
  ['dragleave','drop'].forEach(ev=> dz.addEventListener(ev, e=>{ e.preventDefault(); dz.style.borderColor = ''; }));
  dz.addEventListener('drop', e=>{ const f = e.dataTransfer.files[0]; if(f) handle(f); });
  $('tplBtn').onclick = ()=> exportWorkbook('import_template.xlsx', c=>{ const t = classMonthTable(c, $('impMonth').value); return {headers:t.headers, rows:t.rows.map(r=>({'English name':r['English name'], 'שם התלמיד':r['שם התלמיד']}))}; });
  $('expMonthBtn').onclick = ()=>{ const m = monthById($('expMonth').value); if(m) exportWorkbook(`scores_${m.label}.xlsx`, c=>classMonthTable(c, m.id)); };
  $('expYearBtn').onclick = ()=> exportWorkbook(`scores_${st.currentYear}.xlsx`, c=>{
    let headers = null; const rows = [];
    sortedMonths().forEach(m=>{ if(!monthHasScores(c.id, m.id)) return; const t = classMonthTable(c, m.id); headers = headers && headers.length>=t.headers.length+1 ? headers : ['חודש', ...t.headers]; t.rows.forEach(r=> rows.push(Object.assign({'חודש':m.label}, r))); });
    return {headers: headers || ['חודש', ...classMonthTable(c, (sortedMonths()[0]||{}).id).headers], rows};
  });
  $('expRosterBtn').onclick = ()=> exportWorkbook('classes_and_students.xlsx', c=>({headers:['English name','שם התלמיד'], rows: sortedStudents(c.id).map(s=>({'English name':s.name||'', 'שם התלמיד':s.nameHe||''}))}));
  $('bkDown').onclick = ()=>{
    flushNow();
    const b = Object.assign(statePayload(), {version:7, exportedAt:new Date().toISOString(), letterheadDataUrl: assets.letterheadDataUrl||null});
    const url = URL.createObjectURL(new Blob([JSON.stringify(b)], {type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = `evaluation_backup_${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    logEvent('Download backup');
  };
  $('bkFile').onchange = e=>{
    const f = e.target.files[0]; e.target.value = ''; if(!f) return;
    const fr = new FileReader();
    fr.onload = async ()=>{
      let b; try{ b = JSON.parse(fr.result); }catch(err){ $('bkMsg').textContent = 'Not a valid backup file.'; $('bkMsg').style.color = 'var(--bad)'; return; }
      if(!await askConfirm('Restore '+f.name+'?', 'All current data is replaced. You can undo this from the Audit Log.', 'Restore')) return;
      TRACK.forEach(k=>{ if(b[k]!==undefined) st[k] = b[k]; });
      if(b.typography && !b.sizes){ st.sizes = {}; Object.keys(b.typography).forEach(k=>{ if(b.typography[k] && b.typography[k].size) st.sizes[k] = b.typography[k].size; }); }
      ['students','staff'].forEach(k=>{ if(b[k]===undefined && k==='staff') st.staff = []; });
      assets.letterheadDataUrl = b.letterheadDataUrl || null; currentLetterheadDataUrl = assets.letterheadDataUrl || DEFAULT_LETTERHEAD_DATAURL;
      migrateLoadedState(); persistAssets();
      saveAll('Restore backup', f.name); doneWithUndo('Backup restored'); renderDataTab();
    };
    fr.readAsText(f);
  };
  $('smLoad').onclick = ()=>{ if(st.classes.some(c=>c.isSample)){ toast('Sample data is already loaded'); return; } buildSampleData(); saveAll('Load sample data'); doneWithUndo('Sample data loaded'); };
  $('smRemove').onclick = async ()=>{
    const ids = new Set(st.classes.filter(c=>c.isSample || ['ב (לדוגמה)','ג (לדוגמה)'].includes(c.nameHe)).map(c=>c.id));
    if(!ids.size){ toast('No sample data'); return; }
    if(!await askConfirm('Remove sample data?', 'Only the sample classes, students and teachers are removed.', 'Remove')) return;
    st.classes = st.classes.filter(c=>!ids.has(c.id)); ids.forEach(id=>{ delete st.students[id]; });
    ['grades','sheets','reportStatus'].forEach(k=> Object.keys(st[k]).forEach(key=>{ if(ids.has(key.split('::')[0])) delete st[k][key]; }));
    st.staff = st.staff.filter(s=> !s.isSample || st.classes.some(c=>c.teacherId===s.id));
    saveAll('Remove sample data'); doneWithUndo('Sample data removed');
  };
}

/* =====================================================================
   Audit Log – only your own changes. Undo/Redo don't add rows.
   ===================================================================== */
let auditPage = 0, auditQ = '';
function fmtTime(ts){ return new Date(ts).toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}); }
function renderAudit(){
  const P = $('panel-audit'); if(!P) return;
  pruneAudit();
  const u = undoTarget(), r = redoTarget();
  const q = auditQ.trim().toLowerCase();
  const rows = audit.filter(mine).filter(e=> !q || [e.action, e.detail].join(' ').toLowerCase().includes(q));
  const pages = Math.max(1, Math.ceil(rows.length/AUDIT_PAGE)); if(auditPage >= pages) auditPage = pages-1;
  const slice = rows.slice(auditPage*AUDIT_PAGE, (auditPage+1)*AUDIT_PAGE);
  P.innerHTML = pageHead('Audit Log', `<button class="btn sec" id="auUndo" ${u?'':'disabled'}>${ICON.undo}Undo</button><button class="btn sec" id="auRedo" ${r?'':'disabled'}>${ICON.redo}Redo</button>`) + `
    <div class="card"><div class="audit-bar"><input type="text" id="auQ" placeholder="Search" value="${esc(auditQ)}"><span class="pill">${rows.length}</span><span class="muted small" style="margin-left:auto;">${esc(me.email)} · last ${AUDIT_DAYS} days</span></div>
    <table class="t"><thead><tr><th style="width:150px;">When</th><th style="width:170px;">Who</th><th>What</th><th>Details</th><th></th></tr></thead><tbody>${slice.length ? slice.map(e=>`<tr class="${e.undone?'undone':''}">
      <td>${esc(fmtTime(e.ts))}</td><td>${esc(e.user)}</td><td><span class="what">${esc(e.action)}</span>${e.undone?' <span class="tag">Undone</span>':''}</td><td><span style="unicode-bidi:plaintext;">${esc(e.detail)}</span></td>
      <td class="act">${u && u.id===e.id ? `<button class="btn sm sec" data-undo>${ICON.undo}Undo</button>` : ''}${r && r.id===e.id ? `<button class="btn sm sec" data-redo>${ICON.redo}Redo</button>` : ''}</td></tr>`).join('')
      : '<tr><td colspan="5"><div class="empty">No changes in the last 7 days</div></td></tr>'}</tbody></table>
    ${pages>1?`<div class="row" style="justify-content:flex-end;margin-top:10px;"><button class="btn sec sm" data-pg="-1" ${auditPage===0?'disabled':''}>Previous</button><span class="small muted">${auditPage+1} / ${pages}</span><button class="btn sec sm" data-pg="1" ${auditPage>=pages-1?'disabled':''}>Next</button></div>`:''}</div>`;
  const undo = ()=>{ if(doUndo()) toast('Undone'); renderAudit(); }, redo = ()=>{ if(doRedo()) toast('Redone'); renderAudit(); };
  $('auUndo').onclick = undo; $('auRedo').onclick = redo;
  P.querySelectorAll('[data-undo]').forEach(b=> b.onclick = undo);
  P.querySelectorAll('[data-redo]').forEach(b=> b.onclick = redo);
  $('auQ').oninput = e=>{ auditQ = e.target.value; auditPage = 0; const pos = e.target.selectionStart; renderAudit(); const n = $('auQ'); n.focus(); n.setSelectionRange(pos,pos); };
  P.querySelectorAll('[data-pg]').forEach(b=> b.onclick = ()=>{ auditPage += Number(b.dataset.pg); renderAudit(); });
}

/* =====================================================================
   Sample data
   ===================================================================== */
function rng(seed){ return ()=>{ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed>>>15, 1|seed); t = t + Math.imul(t ^ t>>>7, 61|t) ^ t; return ((t ^ t>>>14)>>>0)/4294967296; }; }
function buildSampleData(){
  const R = rng(5787), y = st.currentYear; ensureYearMonths(y);
  const months = monthsOfYear(y);
  const FIRST = [['Moshe','משה'],['Dovid','דוד'],['Avrohom','אברהם'],['Yaakov','יעקב'],['Shlomo','שלמה'],['Yosef','יוסף'],['Chaim','חיים'],['Shmuel','שמואל'],['Aharon','אהרן'],['Menachem','מנחם'],['Naftali','נפתלי'],['Binyomin','בנימין'],['Yitzchok','יצחק'],['Eliyahu','אליהו'],['Tzvi','צבי'],['Yisroel','ישראל'],['Mordechai','מרדכי'],['Simcha','שמחה'],['Pinchas','פינחס'],['Asher','אשר'],['Meir','מאיר']];
  const LAST = [['Goldberg','גולדברג'],['Weiss','ווייס'],['Klein','קליין'],['Stern','שטרן'],['Berger','ברגר'],['Rosenberg','רוזנברג'],['Friedman','פרידמן'],['Landau','לאנדאו'],['Horowitz','הורוויץ'],['Cohen','כהן'],['Levi','לוי'],['Schwartz','שוורץ'],['Green','גרין'],['Lichtenstein','ליכטנשטיין'],['Eisenberg','אייזנבערג'],['Tannenbaum','טננבוים'],['Halpern','הלפרין'],['Rubin','רובין'],['Fischer','פישר'],['Berliner','ברלינר']];
  const PAR = {'אלול':['שופטים','כי תצא','כי תבוא','נצבים־וילך'], 'תשרי':['האזינו','בראשית','נח','לך לך'], 'חשוון':['וירא','חיי שרה','תולדות','ויצא']};
  const plan = [
    {en:'Aleph', heN:'א', t:['Yosef Berger','יוסף ברגר'], n:11, extra:{label:'כתיבה', kind:'cat'}, base:80},
    {en:'Beis', heN:'ב', t:['Yisroel Leifer','ישראל לייפער'], n:12, base:88},
    {en:'Gimmel', heN:'ג', t:['Moshe Goldstein','משה גולדשטיין'], n:10, extra:{label:'גמרא', kind:'week'}, base:72}
  ];
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));
  plan.forEach(p=>{
    if(st.classes.some(c=>c.nameHe===p.heN)) return;
    const t = {id:uid(), nameEn:p.t[0], nameHe:p.t[1], isSample:true}; st.staff.push(t);
    const cls = {id:uid(), name:p.en, nameHe:p.heN, teacherId:t.id, subjects:defaultSubjects(), isSample:true};
    if(p.extra) cls.subjects.push({id:uid(), label:p.extra.label, kind:p.extra.kind});
    st.classes.push(cls); st.students[cls.id] = [];
    const used = new Set(), kids = [];
    while(kids.length < p.n){
      const f = FIRST[Math.floor(R()*FIRST.length)], l = LAST[Math.floor(R()*LAST.length)], key = f[0]+l[0];
      if(used.has(key)) continue; used.add(key);
      const s = {id:uid(), name:f[0]+' '+l[0], nameHe:f[1]+' '+l[1]}; st.students[cls.id].push(s);
      kids.push({s, skill: clamp(p.base + (R()-0.5)*34, 40, 99), absent: R()<0.25 ? 2 : 0, late: R()<0.25 ? 2 : 0});
    }
    months.forEach(m=>{
      const mn = monthName(m.label); if(!PAR[mn]) return;
      const rec = getGradeRecord(cls.id, m.id), weeks = mn==='חשוון' ? 1 : 4, full = weeks===4;
      PAR[mn].forEach((pp,i)=>{ if(i<weeks) rec.parshiot[i] = pp; });
      kids.forEach(k=>{
        const d = rec.perStudent[k.s.id] = emptyStudentRecord(cls);
        d.chesarim = full ? String(Math.floor(R()*(2+k.absent))) : '';
        d.ichurim = full ? String(Math.floor(R()*(2+k.late))) : '';
        d.yatza = full && R()<0.12 ? '1' : '';
        cls.subjects.forEach(s=>{
          if(s.kind==='cat'){ if(full) d.cat[s.id] = String(clamp(Math.round(k.skill/10 + (R()-0.4)*2), 1, 10)); }
          else for(let w=0; w<weeks; w++){ if(R()<0.05) continue; d.week[s.id][w] = String(clamp(Math.round(k.skill + (R()-0.5)*22), 0, 100)); }
        });
      });
      if(mn==='תשרי'){ st.sheets[gradeKey(cls.id, m.id)] = {code:newCode(), at:Date.now(), layout:sheetLayout(cls, m.id), sig:'', scannedAt:Date.now()}; st.sheets[gradeKey(cls.id, m.id)].sig = layoutSig(st.sheets[gradeKey(cls.id, m.id)].layout); }
    });
  });
}

/* =====================================================================
   Start
   ===================================================================== */
function showGate(msg, signOut){
  $('gate').classList.remove('hidden');
  if(msg) $('loginMsg').textContent = msg;
  if(signOut){ const b = document.createElement('button'); b.className = 'btn sec'; b.textContent = 'Sign out'; b.style.marginTop = '8px'; b.onclick = async ()=>{ try{ await SB.auth.signOut(); }catch(e){} location.reload(); }; $('loginMsg').after(b); }
  setTimeout(()=>$('loginEmail').focus(), 50);
}
async function initCloud(){
  try{ await sbInit(); }catch(e){ showGate(e.message); return false; }
  const ses = (await SB.auth.getSession()).data.session;
  if(!ses){ showGate(); return false; }
  const email = String(ses.user.email||'').toLowerCase();
  const r = await SB.from('gilyon_users').select('*').eq('email', email).maybeSingle();
  if(r.error || !r.data){ showGate(email+' does not have access. Ask an Admin to add you.', true); return false; }
  if(!r.data.active){ showGate('This account is disabled. Contact an Admin.', true); return false; }
  me = {id:r.data.id, email, role:r.data.role, active:true};
  SB.rpc('gilyon_touch_login').then(()=>{}, ()=>{});
  setStatus('saving'); $('saveText').textContent = 'Loading…';
  const row = sbErr(await SB.from('gilyon_state').select('data,version').eq('id','main').maybeSingle());
  const data = (row && row.data) || {};
  TRACK.forEach(k=>{ if(data[k]!==undefined) st[k] = clone(data[k]); });
  cloudVersion = Number(row && row.version || 0);
  const oldShape = !!Object.keys(data).length && data.schemaVersion!==7;
  if(data.letterheadDataUrl && canEdit()) assets.letterheadDataUrl = data.letterheadDataUrl;
  await Promise.all([ canEdit() ? loadUsersCloud() : Promise.resolve(users = [me]), loadSecretsCloud(), loadAuditCloud(),
    data.letterheadDataUrl ? Promise.resolve() : loadAssetsCloud() ]);
  if(data.letterheadDataUrl && canEdit()) saveAssetsCloud();
  currentLetterheadDataUrl = assets.letterheadDataUrl || DEFAULT_LETTERHEAD_DATAURL;
  migrateLoadedState();
  pruneAudit();
  snap = trackState(); synced = remoteTrack(data);
  if(canEdit()){ if(oldShape) cloudPush(true); else if(diffPatch(synced, snap).length) cloudPush(); }
  startPoll();
  return true;
}
(async function init(){
  initEyes();
  $('gateLogo').src = $('railLogo').src;
  if(CLOUD){
    if(!await initCloud()) return;
  } else {
  await loadUsers();
  me = users.find(u=>u.id===localStorage.getItem(SESSION_KEY) && u.active) || null;
  if(!me && TEST_MODE){ me = users.find(u=>u.active && u.role==='admin'); localStorage.setItem(SESSION_KEY, me.id); }
  if(!me){ showGate(); return; }
  const saved = await KV.get('state');
  if(saved) Object.keys(saved).forEach(k=>{ if(k!=='schemaVersion') st[k] = saved[k]; });
  const a = await KV.get('assets'); if(a) assets.letterheadDataUrl = a.letterheadDataUrl || null;
  if(st.letterheadDataUrl){ assets.letterheadDataUrl = st.letterheadDataUrl; delete st.letterheadDataUrl; }
  if(saved && saved.typography && !saved.sizes){ st.sizes = Object.assign({}, DEFAULT_SIZES); }
  currentLetterheadDataUrl = assets.letterheadDataUrl || DEFAULT_LETTERHEAD_DATAURL;
  audit = (await KV.get('audit')) || [];
  if(saved && saved.schemaVersion!==7){
    // the old sample data is replaced by the new one (with English names); real data is kept
    const old = new Set((st.classes||[]).filter(c=>c.isSample).map(c=>c.id));
    if(old.size){
      st.classes = st.classes.filter(c=>!old.has(c.id)); old.forEach(id=>{ if(st.students) delete st.students[id]; });
      Object.keys(st.grades||{}).forEach(k=>{ if(old.has(k.split('::')[0])) delete st.grades[k]; });
      migrateLoadedState(); buildSampleData();
    }
  }
  migrateLoadedState();
  const fresh = !saved || !st.classes.length && !Object.keys(st.grades).length;
  if(fresh) buildSampleData();
  pruneAudit();
  snap = trackState();
  if(fresh || (saved && saved.schemaVersion!==7)) await persistState();
  }
  $('whoEmail').textContent = me.email;
  $('whoRole').textContent = me.role==='admin' ? 'Admin' : 'View';
  if(TEST_MODE) $('signOutBtn').textContent = me.role==='admin' ? 'Switch to View' : 'Switch to Admin';
  setStatus(canEdit() ? 'saved' : 'view');
  buildNav();
  activateTab('dashboard');
})();
})();
</script>
</body>
</html>
