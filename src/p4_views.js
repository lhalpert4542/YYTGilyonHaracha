
/* =====================================================================
   Navigation
   ===================================================================== */
const NAV = [
  ['dashboard','Dashboard','<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>'],
  ['students','Students','<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'],
  ['scores','Scores','<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>'],
  ['assessments','Assessments','<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'],
  ['reports','Reports','<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></svg>'],
  ['settings','Settings','<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'],
  ['audit','Audit Log','<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>']
];
const VIEW_TABS = ['dashboard','scores','reports','profile'];
let activeTab = 'dashboard';
function buildNav(){
  $('mainNav').innerHTML = NAV.filter(([k])=> canEdit() || VIEW_TABS.includes(k)).map(([k,l,i])=>`<button type="button" data-tab="${k}">${i}<span>${l}</span></button>`).join('');
  $('mainNav').querySelectorAll('button').forEach(b=> b.addEventListener('click', ()=>activateTab(b.dataset.tab)));
}
function activateTab(tab){
  if(!canEdit() && !VIEW_TABS.includes(tab)) tab = 'dashboard';
  flushNow();
  activeTab = tab;
  document.querySelectorAll('#mainNav button').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab || (tab==='profile' && b.dataset.tab===(canEdit()?'students':'dashboard'))));
  document.querySelectorAll('section.panel').forEach(p=>p.classList.toggle('active', p.id==='panel-'+tab));
  renderActive();
  window.scrollTo(0,0);
}
function renderActive(){
  ({dashboard:renderDashboard, profile:renderProfile, students:renderStudents, scores:renderScores, assessments:renderAssessments, reports:renderReports, settings:renderSettings, audit:renderAudit}[activeTab] || (()=>{}))();
}
const pageHead = (title, extra='') => `<div class="page-head"><h1>${esc(title)}</h1><span class="sp"></span>${extra}</div>`;
const classLabel = c => enName(c) + (c.nameHe && c.nameHe!==enName(c) ? ' · '+c.nameHe : '');

/* =====================================================================
   Averages
   ===================================================================== */
function avgOf(arr){ const nums = arr.filter(v=>v!==''&&v!=null).map(Number).filter(n=>!isNaN(n)); return nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : null; }
function studentOverallAvg(d, cls, wc){
  const wv = []; cls.subjects.filter(s=>s.kind==='week').forEach(s=> (d.week[s.id]||[]).slice(0,wc).forEach(v=>{ if(v!=='') wv.push(Number(v)); }));
  const w = avgOf(wv);
  const c = avgOf(cls.subjects.filter(s=>s.kind==='cat').map(s=> d.cat[s.id]==='' || d.cat[s.id]===undefined ? '' : Number(d.cat[s.id])*10));
  return avgOf([w, c].filter(v=>v!==null));
}
function studentYearAvg(cls, sid){
  const vals = [];
  sortedMonths().forEach(m=>{ const rec = recFor(cls.id, m.id), d = rec && rec.perStudent[sid]; if(!d) return; ensureRecordShape(d, cls); const v = studentOverallAvg(d, cls, rec.weekCount); if(v!==null) vals.push(v); });
  return avgOf(vals);
}
function unionSubjects(){ const map = new Map(); st.classes.forEach(c=> (c.subjects||[]).forEach(s=>{ const k = s.kind+'::'+s.label; if(!map.has(k)) map.set(k, {kind:s.kind, label:s.label}); })); return Array.from(map.values()); }
function classSubjectYearAvg(cls, subj){
  const match = (cls.subjects||[]).find(s=>s.kind===subj.kind && s.label===subj.label); if(!match) return null;
  const monthly = [];
  sortedMonths().forEach(m=>{
    const rec = recFor(cls.id, m.id); if(!rec) return;
    const vals = [];
    studentsOf(cls.id).forEach(s=>{
      const d = rec.perStudent[s.id]; if(!d) return; ensureRecordShape(d, cls);
      if(subj.kind==='cat'){ if(d.cat[match.id]!=='') vals.push(Number(d.cat[match.id])*10); }
      else (d.week[match.id]||[]).slice(0,rec.weekCount).forEach(v=>{ if(v!=='') vals.push(Number(v)); });
    });
    const a = avgOf(vals); if(a!==null) monthly.push(a);
  });
  return avgOf(monthly);
}
function hasAnyScore(d){
  if(!d) return false;
  if([d.chesarim,d.ichurim,d.yatza].some(v=>v!=='' && v!=null)) return true;
  if(Object.values(d.cat||{}).some(v=>v!=='' && v!=null)) return true;
  return Object.values(d.week||{}).some(a=>(a||[]).some(v=>v!=='' && v!=null));
}
const monthHasScores = (classId, monthId) => { const r = recFor(classId, monthId); return !!r && Object.values(r.perStudent).some(hasAnyScore); };

/* =====================================================================
   Dashboard – compact lists with Hebrew names; click a student to open them
   ===================================================================== */
function studentTotals(cls, sid){
  let ab = 0, la = 0, ye = 0;
  sortedMonths().forEach(m=>{ const rec = recFor(cls.id, m.id), d = rec && rec.perStudent[sid]; if(!d) return;
    const n = v => (v!=='' && v!=null && !isNaN(Number(v))) ? Number(v) : 0;
    ab += n(d.chesarim); la += n(d.ichurim); ye += n(d.yatza); });
  return {ab, la, ye};
}
// a student's year average for one subject (monthly 1–10, weekly 0–100)
function studentSubjectAvg(cls, sid, sj){
  const vals = [];
  sortedMonths().forEach(m=>{ const rec = recFor(cls.id, m.id), d = rec && rec.perStudent[sid]; if(!d) return;
    if(sj.kind==='cat'){ const v = (d.cat||{})[sj.id]; if(v!=='' && v!=null && !isNaN(Number(v))) vals.push(Number(v)); }
    else ((d.week||{})[sj.id]||[]).slice(0, rec.weekCount).forEach(v=>{ if(v!=='' && v!=null && !isNaN(Number(v))) vals.push(Number(v)); });
  });
  return avgOf(vals);
}
function renderDashboard(){
  const T = st.dashboardThresholds, P = $('panel-dashboard');
  const all = [], low = [];
  st.classes.forEach(cls=> studentsOf(cls.id).forEach(s=>{
    all.push(Object.assign({cls, s}, studentTotals(cls, s.id)));
    (cls.subjects||[]).forEach(sj=>{
      const a = studentSubjectAvg(cls, s.id, sj); if(a===null) return;
      const pct = sj.kind==='cat' ? a*10 : a;
      if(pct < T.low) low.push({cls, s, sj, a, pct});
    });
  }));
  low.sort((x,y)=>x.pct-y.pct);
  const abs = all.filter(r=>r.ab > T.absences).sort((a,b)=>b.ab-a.ab);
  const lat = all.filter(r=>r.la > T.lates).sort((a,b)=>b.la-a.la);
  const monthsWith = sortedMonths().filter(m=> st.classes.some(c=>monthHasScores(c.id, m.id))).length;
  const thr = k => `<input type="number" class="thr" data-thr="${k}" value="${T[k]}" min="0" ${canEdit()?'':'disabled'}>`;
  const fmt = r => r.sj.kind==='cat' ? (Math.round(r.a*10)/10).toString() : Math.round(r.a);
  const list = (rows, val, klass, sub) => rows.length ? `<div class="dlist">${rows.map(r=>`<button type="button" class="drow" data-cls="${esc(r.cls.id)}" data-sid="${esc(r.s.id)}"><span class="v ${klass}">${val(r)}</span>${sub?`<span class="sj he">${esc(r.sj.label)}</span>`:''}<span class="c he">${esc(heName(r.cls))}</span><span class="n he">${esc(heName(r.s))}</span></button>`).join('')}</div>` : '<div class="empty">None</div>';
  P.innerHTML = pageHead('Dashboard', `<span class="tag wait he" style="font-size:13px;">${esc(st.currentYear)}</span>`) + `
    <div class="stat-grid three">
      <div class="stat"><div class="n">${all.length}</div><div class="l">Students</div></div>
      <div class="stat"><div class="n">${st.classes.length}</div><div class="l">Classes</div></div>
      <div class="stat"><div class="n">${monthsWith}</div><div class="l">Months with scores</div></div>
    </div>
    <div class="dash-cols three">
      <div class="card ins low"><h2>Below ${thr('low')} by subject <span class="pill">${low.length}</span></h2><div class="small muted" style="margin:-6px 0 8px;">Monthly subjects below ${T.low/10} out of 10</div>${list(low, fmt, 'bad', true)}</div>
      <div class="card ins low"><h2>Absences over ${thr('absences')} <span class="pill">${abs.length}</span></h2>${list(abs, r=>r.ab, 'bad')}</div>
      <div class="card ins warn"><h2>Lates over ${thr('lates')} <span class="pill">${lat.length}</span></h2>${list(lat, r=>r.la, 'mid')}</div>
    </div>`;
  P.querySelectorAll('.thr').forEach(inp=> inp.addEventListener('change', ()=>{
    st.dashboardThresholds[inp.dataset.thr] = Math.max(0, Math.floor(Number(inp.value)||0));
    saveAll('Dashboard limits'); renderDashboard();
  }));
  P.querySelectorAll('.drow').forEach(b=> b.addEventListener('click', ()=> openProfile(b.dataset.cls, b.dataset.sid)));
}

/* =====================================================================
   Student profile – scores by month and reports (like Kriah)
   ===================================================================== */
let profile = null;   // {classId, sid}
function openProfile(classId, sid){ profile = {classId, sid}; activateTab('profile'); }
const openStudentReport = openProfile;
function renderProfile(){
  const P = $('panel-profile'), cls = profile && classById(profile.classId), s = cls && studentsOf(cls.id).find(x=>x.id===profile.sid);
  if(!s){ P.innerHTML = '<div class="empty">Student not found</div>'; return; }
  const months = sortedMonths().filter(m=>{ const r = recFor(cls.id, m.id); return r && hasAnyScore(r.perStudent[s.id]); });
  const catS = cls.subjects.filter(x=>x.kind==='cat'), weekS = cls.subjects.filter(x=>x.kind==='week');
  const t = studentTotals(cls, s.id), ya = studentYearAvg(cls, s.id);
  const rows = months.map(m=>{
    const rec = recFor(cls.id, m.id), d = ensureRecordShape(clone(rec.perStudent[s.id]), cls);
    const wAvg = sj => avgOf((d.week[sj.id]||[]).slice(0, rec.weekCount));
    return {m, rec, d, avg: studentOverallAvg(d, cls, rec.weekCount), wAvg};
  });
  const T = st.dashboardThresholds, tone = v => v===null ? '' : v < T.low ? 'bad-cell' : v >= T.high ? 'good-cell' : '';
  const trend = rows.length ? `<div class="trend">${rows.map(r=>{ const v = r.avg===null ? 0 : Math.round(r.avg); return `<div class="tb"><div class="bar-wrap"><div class="bar ${v<T.low?'b':v>=T.high?'g':''}" style="height:${Math.max(4,v)}%"></div></div><b>${r.avg===null?'—':v}</b><span class="he">${esc(monthName(r.m.label))}</span></div>`; }).join('')}</div>` : '<div class="empty">No scores yet</div>';
  const head = `<tr class="grp"><th rowspan="2">חודש</th><th colspan="3" class="gs">נוכחות</th>${catS.length?`<th colspan="${catS.length}" class="gs">ניקוד (1–10)</th>`:''}${weekS.length?`<th colspan="${weekS.length}" class="gs">ממוצע שבועי</th>`:''}<th rowspan="2" class="gs">ממוצע</th></tr>
    <tr><th class="gs">חסר</th><th>איחור</th><th>יצא מוקדם</th>${catS.map((x,i)=>`<th class="${i===0?'gs':''}">${esc(x.label)}</th>`).join('')}${weekS.map((x,i)=>`<th class="${i===0?'gs':''}">${esc(x.label)}</th>`).join('')}</tr>`;
  const body = rows.map(r=>`<tr class="click" data-m="${r.m.id}"><td class="name">${esc(r.m.label)}</td><td class="gs">${esc(r.d.chesarim)}</td><td>${esc(r.d.ichurim)}</td><td>${esc(r.d.yatza)}</td>
    ${catS.map((x,i)=>`<td class="${i===0?'gs':''}">${esc(r.d.cat[x.id]||'')}</td>`).join('')}${weekS.map((x,i)=>{ const a = r.wAvg(x); return `<td class="${i===0?'gs':''}">${a===null?'':Math.round(a)}</td>`; }).join('')}
    <td class="gs ${tone(r.avg)}">${r.avg===null?'':Math.round(r.avg)}</td></tr>`).join('');
  P.innerHTML = `<div class="page-head"><button class="btn sec sm" id="pfBack">${ICON.left}${canEdit()?'Students':'Dashboard'}</button><span class="sp"></span><button class="btn sec" id="pfEdit">${canEdit()?ICON.edit+'Edit scores':'Scores'}</button></div>
    <div class="card pf-head"><div><div class="pf-name he">${esc(heName(s))}</div><div class="muted">${esc(s.name||'')}</div></div>
      <div class="pf-meta"><div><span class="muted small">Class</span><b>${esc(classLabel(cls))}</b></div><div><span class="muted small">Teacher</span><b class="he">${esc(heName(teacherOf(cls))||'—')}</b></div></div></div>
    <div class="stat-grid">
      <div class="stat"><div class="n ${ya===null?'':ya<T.low?'t-bad':ya>=T.high?'t-good':''}">${ya===null?'—':Math.round(ya)}</div><div class="l">Average</div></div>
      <div class="stat"><div class="n">${t.ab}</div><div class="l">Absences</div></div>
      <div class="stat"><div class="n">${t.la}</div><div class="l">Lates</div></div>
      <div class="stat"><div class="n">${t.ye}</div><div class="l">Left early</div></div>
    </div>
    <div class="card"><h2>Average by month</h2>${trend}</div>
    <div class="card"><h2>Scores</h2>${rows.length ? `<div class="grid-wrap" dir="rtl"><table class="entry rtl pf-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>` : '<div class="empty">No scores yet</div>'}</div>
    <div class="card"><h2>Reports</h2>${rows.length ? `<table class="t"><tbody>${rows.map(r=>`<tr data-m="${r.m.id}"><td>${he(r.m.label)}</td><td class="act">${iconBtn('view','Preview','data-pr="view"')}${iconBtn('print','Print','data-pr="print"')}${iconBtn('download','Download PDF','data-pr="pdf"')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No reports yet</div>'}</div>`;
  $('pfBack').onclick = ()=>{ stuFilter = cls.id; activateTab(canEdit() ? 'students' : 'dashboard'); };
  $('pfEdit').onclick = ()=>{ scoreClassId = cls.id; scoreMonthId = (months[months.length-1]||{}).id || ''; activateTab('scores'); };
  P.querySelectorAll('.pf-table tr.click').forEach(tr=> tr.onclick = ()=>{ scoreClassId = cls.id; scoreMonthId = tr.dataset.m; activateTab('scores'); });
  P.querySelectorAll('[data-pr]').forEach(b=> b.onclick = ()=>{
    const m = monthById(b.closest('tr').dataset.m), item = {cls, month:m, s, rec:recFor(cls.id, m.id)};
    if(b.dataset.pr==='print') return printReports([item], lhOpt());
    if(b.dataset.pr==='pdf') return downloadReports([item], lhOpt(), lastKey(s)+' '+m.label);
    openModal(`<div class="card-head"><h2 style="margin:0;">${esc(m.label)}</h2><span class="sp"></span>${iconBtn('print','Print','data-a="print"')}${iconBtn('download','Download PDF','data-a="pdf"')}<button class="btn sm" data-a="close">Close</button></div><div id="pfPv"></div>`, box=>{
      showPreview($('pfPv'), reportPageHtml(cls, m, s, item.rec, lhOpt()));
      box.querySelector('[data-a=close]').onclick = closeModal;
      box.querySelector('[data-a=print]').onclick = ()=>printReports([item], lhOpt());
      box.querySelector('[data-a=pdf]').onclick = ()=>downloadReports([item], lhOpt(), lastKey(s)+' '+m.label);
    }, true);
  });
}

/* =====================================================================
   Students
   ===================================================================== */
let stuFilter = '', stuSearch = '';
function findOrCreateClass(name, nameHe){
  name = String(name||'').trim(); nameHe = String(nameHe||'').trim();
  if(!name && !nameHe) return null;
  let cls = st.classes.find(c=> (name && (c.name===name || c.nameHe===name)) || (nameHe && (c.nameHe===nameHe || c.name===nameHe)));
  if(!cls){ cls = {id:uid(), name: name && !isHeb(name) ? name : '', nameHe: nameHe || (isHeb(name)?name:''), teacherId:'', subjects: defaultSubjects()}; st.classes.push(cls); st.students[cls.id] = []; }
  else { if(!cls.nameHe && nameHe) cls.nameHe = nameHe; if(!cls.name && name && !isHeb(name)) cls.name = name; }
  return ensureClassShape(cls);
}
function findOrCreateStaff(nameEn, nameHe){
  nameEn = String(nameEn||'').trim(); nameHe = String(nameHe||'').trim();
  if(!nameEn && !nameHe) return null;
  let s = st.staff.find(x=> (nameEn && (x.nameEn===nameEn || x.nameHe===nameEn)) || (nameHe && (x.nameHe===nameHe || x.nameEn===nameHe)));
  if(!s){ s = {id:uid(), nameEn: nameEn && !isHeb(nameEn) ? nameEn : '', nameHe: nameHe || (isHeb(nameEn)?nameEn:'')}; st.staff.push(s); }
  else { if(!s.nameHe && nameHe) s.nameHe = nameHe; if(!s.nameEn && nameEn && !isHeb(nameEn)) s.nameEn = nameEn; }
  return s;
}
function findOrCreateStudent(classId, name, nameHe){
  name = String(name||'').trim(); nameHe = String(nameHe||'').trim();
  if(isHeb(name) && !nameHe){ nameHe = name; name = ''; }
  if(!name && !nameHe) return null;
  st.students[classId] = st.students[classId] || [];
  let s = st.students[classId].find(x=> (name && x.name===name) || (nameHe && x.nameHe===nameHe));
  if(!s){ s = {id:uid(), name, nameHe}; st.students[classId].push(s); }
  else { if(!s.nameHe && nameHe) s.nameHe = nameHe; if(!s.name && name) s.name = name; }
  return s;
}
function moveStudent(s, fromId, toId){
  if(fromId===toId) return;
  st.students[fromId] = studentsOf(fromId).filter(x=>x.id!==s.id);
  st.students[toId] = studentsOf(toId).concat([s]);
  const to = classById(toId);
  Object.keys(st.grades).forEach(k=>{
    const [cid, mid] = k.split('::'); if(cid!==fromId) return;
    const d = st.grades[k].perStudent[s.id]; if(!d) return;
    delete st.grades[k].perStudent[s.id];
    const rec = getGradeRecord(toId, mid);
    rec.perStudent[s.id] = ensureRecordShape(d, to);
  });
}
function renderStudents(){
  const P = $('panel-students');
  if(stuFilter && !classById(stuFilter)) stuFilter = '';
  const all = []; st.classes.forEach(c=> sortedStudents(c.id).forEach(s=> all.push({c, s})));
  const inClass = stuFilter ? all.filter(r=>r.c.id===stuFilter) : all;
  const q = stuSearch.trim().toLowerCase();
  const shown = q ? inClass.filter(r=> (enName(r.s)+' '+(r.s.nameHe||'')).toLowerCase().includes(q)) : inClass;
  const chips = `<div class="tabs" style="margin-bottom:12px;">${[{id:'', label:'All', n:all.length}].concat(st.classes.map(c=>({id:c.id, label:classLabel(c), n:studentsOf(c.id).length}))).map(t=>`<button data-f="${esc(t.id)}" class="${t.id===stuFilter?'on':''}">${esc(t.label)} <span class="pill" style="height:18px;font-size:11px;">${t.n}</span></button>`).join('')}</div>`;
  const addCls = stuFilter || (st.classes[0] && st.classes[0].id) || '';
  P.innerHTML = pageHead('Students', `<button class="btn sec" id="pasteStu">${ICON.plus}Paste / upload list</button>`) + `
    ${st.classes.length ? '' : '<div class="notice warn">Add a class first in Settings → Classes &amp; Staff.</div>'}
    <div class="card"><div class="row">
      <input type="text" id="newStuEn" placeholder="English name" style="flex:1 1 180px;">
      <input type="text" id="newStuHe" placeholder="שם בעברית" dir="rtl" style="flex:1 1 180px;">
      <select id="newStuClass" style="flex:0 1 200px;">${options(st.classes, c=>c.id, classLabel, addCls)}</select>
      <button class="btn" id="addStuBtn" ${st.classes.length?'':'disabled'}>${ICON.plus}Add</button></div></div>
    <div class="card">${chips}
      <div class="card-head"><input type="text" id="stuSearch" placeholder="Search" value="${esc(stuSearch)}" style="width:240px;"></div>
      ${shown.length ? `<table class="t"><thead><tr><th style="width:1%;">#</th><th>Name</th><th>Hebrew name</th>${stuFilter?'':'<th>Class</th>'}<th></th></tr></thead><tbody>
        ${shown.map((r,i)=>`<tr data-cid="${esc(r.c.id)}" data-sid="${esc(r.s.id)}"><td class="num">${i+1}</td><td><a href="#" data-open>${esc(r.s.name||'')}</a></td><td><a href="#" data-open>${he(r.s.nameHe||'')}</a></td>${stuFilter?'':`<td>${esc(classLabel(r.c))}</td>`}
        <td class="act">${iconBtn('edit','Edit','data-act="edit"')}${iconBtn('trash','Remove','data-act="del"','danger')}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">No students</div>'}
    </div>`;
  P.querySelectorAll('.tabs [data-f]').forEach(b=> b.onclick = ()=>{ stuFilter = b.dataset.f; renderStudents(); });
  $('stuSearch').addEventListener('input', e=>{ stuSearch = e.target.value; const pos = e.target.selectionStart; renderStudents(); const n = $('stuSearch'); n.focus(); n.setSelectionRange(pos,pos); });
  $('pasteStu').onclick = openPasteStudents;
  const add = ()=>{
    const en = $('newStuEn').value.trim(), h = $('newStuHe').value.trim(), cid = $('newStuClass').value;
    if(!cid){ toast('Add a class first'); return; }
    if(!en && !h){ $('newStuEn').focus(); toast('Type a name'); return; }
    if(studentsOf(cid).some(s=> (en && s.name===en) || (h && s.nameHe===h))){ toast('Already in this class'); return; }
    st.students[cid] = studentsOf(cid).concat([{id:uid(), name:en, nameHe:h}]);
    saveAll('Add student', (h||en)+' · '+enName(classById(cid))); flushNow();
    stuSearch = ''; renderStudents(); $('newStuClass').value = cid; $('newStuEn').focus();
    toast((h||en)+' added');
  };
  $('addStuBtn').addEventListener('click', add);
  ['newStuEn','newStuHe'].forEach(id=> $(id).addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); add(); } }));
  P.querySelectorAll('[data-open]').forEach(a=> a.addEventListener('click', e=>{ e.preventDefault(); const tr = a.closest('tr'); openProfile(tr.dataset.cid, tr.dataset.sid); }));
  P.querySelectorAll('[data-act]').forEach(b=> b.addEventListener('click', async ()=>{
    const tr = b.closest('tr'), cid = tr.dataset.cid, s = studentsOf(cid).find(x=>x.id===tr.dataset.sid); if(!s) return;
    if(b.dataset.act==='del'){
      if(!await askConfirm('Remove '+(enName(s))+'?', 'Their scores and attendance will be removed.', 'Remove')) return;
      st.students[cid] = studentsOf(cid).filter(x=>x.id!==s.id);
      Object.keys(st.grades).forEach(k=>{ if(k.startsWith(cid+'::')) delete st.grades[k].perStudent[s.id]; });
      saveAll('Remove student', heName(s)); doneWithUndo(enName(s)+' removed'); renderStudents(); return;
    }
    openModal(`<h2>Edit student</h2><div class="fl">
      <div><label>English name</label><input type="text" id="esEn" value="${esc(s.name||'')}"></div>
      <div><label>Hebrew name</label><input type="text" id="esHe" dir="rtl" value="${esc(s.nameHe||'')}"></div>
      <div><label>Class</label><select id="esCls">${options(st.classes, c=>c.id, classLabel, cid)}</select></div></div>
      <div class="actions"><button class="btn sec" data-a="no">Cancel</button><button class="btn" data-a="yes">Save</button></div>`, box=>{
      $('esEn').focus();
      box.querySelector('[data-a=no]').onclick = closeModal;
      box.querySelector('[data-a=yes]').onclick = ()=>{
        const en = $('esEn').value.trim(), h = $('esHe').value.trim(), to = $('esCls').value;
        if(!en && !h) return;
        s.name = en; s.nameHe = h; moveStudent(s, cid, to);
        closeModal(); saveAll('Edit student', h||en); renderStudents();
      };
    });
  }));
}

/* ---------- paste from Excel / upload CSV ---------- */
function parseStudentRows(rows){
  // columns: Class · English name · Hebrew name   (a header row is skipped)
  const out = [];
  rows.forEach((r, i)=>{
    r = (r||[]).map(v=>String(v??'').trim());
    if(!r.some(Boolean)) return;
    if(i===0 && /class|כתה|כיתה|name|שם/i.test(r.join(' ')) && !st.classes.some(c=>c.name===r[0]||c.nameHe===r[0])) return;
    let [cls, a, b] = r;
    if(!cls) return;
    let en = a||'', h = b||'';
    if(!h && isHeb(en)){ h = en; en = ''; }
    if(!en && !h) return;
    out.push({cls, en, h});
  });
  return out;
}
function openPasteStudents(){
  openModal(`<h2>Add a list of students</h2>
    <p class="small muted" style="margin-bottom:8px;">Three columns: <b>Class</b> · <b>English name</b> · <b>Hebrew name</b>. Copy them from Excel and paste below, or upload a CSV / Excel file.</p>
    <div class="row" style="margin-bottom:8px;"><button class="btn sec sm" data-a="tpl">${ICON.download}CSV template</button><label class="btn sec sm" for="stuFile" style="cursor:pointer;">Upload file</label><input type="file" id="stuFile" accept=".csv,.xlsx,.xls" style="display:none;"></div>
    <textarea id="stuPaste" style="width:100%;min-height:170px;font-family:var(--font-body);" placeholder="Aleph&#9;Moshe Cohen&#9;משה כהן"></textarea>
    <div id="stuPasteInfo" class="small" style="margin-top:6px;min-height:16px;"></div>
    <div class="actions"><button class="btn sec" data-a="no">Cancel</button><button class="btn" data-a="yes" disabled>Add</button></div>`, box=>{
    let parsed = [];
    const show = rows=>{
      parsed = parseStudentRows(rows);
      const newCls = new Set(parsed.filter(p=>!st.classes.some(c=>c.name===p.cls||c.nameHe===p.cls)).map(p=>p.cls));
      $('stuPasteInfo').innerHTML = parsed.length ? `<b>${parsed.length}</b> students${newCls.size?` · new classes: ${[...newCls].map(esc).join(', ')}`:''}` : '';
      box.querySelector('[data-a=yes]').disabled = !parsed.length;
    };
    $('stuPaste').addEventListener('input', e=>{
      const t = e.target.value, sep = t.includes('\t') ? '\t' : ',';
      show(t.split(/\r?\n/).map(l=>l.split(sep)));
    });
    $('stuFile').onchange = e=>{
      const f = e.target.files[0]; if(!f) return;
      const fr = new FileReader();
      fr.onload = ()=>{ try{ const wb = XLSX.read(fr.result, {type:'array'}); const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, defval:''}); $('stuPaste').value = rows.map(r=>r.join('\t')).join('\n'); show(rows); }catch(err){ $('stuPasteInfo').textContent = err.message; } };
      fr.readAsArrayBuffer(f);
    };
    box.querySelector('[data-a=tpl]').onclick = ()=>{
      const c = st.classes[0], rows = [['Class','English name','Hebrew name'], [c?enName(c):'Aleph','Moshe Cohen','משה כהן']];
      const csv = '﻿' + rows.map(r=>r.map(v=>/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
      const a = document.createElement('a'); a.href = url; a.download = 'students_template.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };
    box.querySelector('[data-a=no]').onclick = closeModal;
    box.querySelector('[data-a=yes]').onclick = ()=>{
      let added = 0;
      parsed.forEach(p=>{ const cls = findOrCreateClass(p.cls, isHeb(p.cls)?p.cls:''); const n = studentsOf(cls.id).length; findOrCreateStudent(cls.id, p.en, p.h); if(studentsOf(cls.id).length>n) added++; });
      saveAll('Add student list', added+' students'); closeModal(); doneWithUndo(added+' students added'); renderStudents();
    };
    $('stuPaste').focus();
  });
}

/* =====================================================================
   Scores – Hebrew, right to left. Tab moves across, Enter moves down.
   ===================================================================== */
let scoreClassId = '', scoreMonthId = '';
function buildColumnDefs(cls, wc){
  const defs = [{type:'chesarim', he:'חסר'},{type:'ichurim', he:'איחור'},{type:'yatza', he:'יצא מוקדם'}];
  cls.subjects.filter(s=>s.kind==='cat').forEach(s=> defs.push({type:'cat', id:s.id, he:s.label}));
  const ws = cls.subjects.filter(s=>s.kind==='week');
  for(let w=0; w<wc; w++) ws.forEach(s=> defs.push({type:'week', id:s.id, week:w, he:s.label}));
  return defs;
}
function validCell(def, raw){
  const v = String(raw??'').trim(); if(v==='') return true;
  const n = Number(v); if(isNaN(n)) return false;
  if(def.type==='cat') return n>=1 && n<=10;
  if(def.type==='week') return n>=0 && n<=100;
  return Number.isInteger(n) && n>=0 && n<=31;
}
function cellValue(d, def){ if(def.type==='cat') return (d.cat||{})[def.id]; if(def.type==='week') return ((d.week||{})[def.id]||[])[def.week]; return d[def.type]; }
function setCellValue(d, def, v){ if(def.type==='cat') d.cat[def.id] = v; else if(def.type==='week'){ if(!d.week[def.id]) d.week[def.id] = ['','','','','']; d.week[def.id][def.week] = v; } else d[def.type] = v; }
function gridHead(cls, wc, parshiot, editable){
  const catS = cls.subjects.filter(s=>s.kind==='cat'), weekS = cls.subjects.filter(s=>s.kind==='week');
  let g = `<tr class="grp"><th rowspan="2">תלמיד</th><th colspan="3" class="gs">נוכחות</th>`;
  if(catS.length) g += `<th colspan="${catS.length}" class="gs">ניקוד (1–10)</th>`;
  for(let w=0; w<wc; w++){
    if(!weekS.length) continue;
    let ctl = '';
    if(editable && w===wc-1 && wc<5) ctl = `<button type="button" class="wk-btn" data-wk="add" data-tip="Add week 5">+</button>`;
    if(editable && w===4) ctl = `<button type="button" class="wk-btn" data-wk="remove" data-tip="Remove week 5">×</button>`;
    g += `<th colspan="${weekS.length}" class="wkh gs"><div class="wk">שבוע ${w+1} ${ctl}</div><input type="text" class="parsha" data-idx="${w}" dir="rtl" placeholder="פרשה" value="${esc(parshiot[w]||'')}"></th>`;
  }
  const defs = buildColumnDefs(cls, wc), gs = groupStarts(defs);
  g += '</tr><tr>' + defs.map((d,i)=>`<th class="${gs[i]?'gs':''}">${esc(d.he)}</th>`).join('');
  return g + '</tr>';
}
function renderScores(){
  const P = $('panel-scores');
  if(!classById(scoreClassId)) scoreClassId = st.classes[0] ? st.classes[0].id : '';
  const months = sortedMonths();
  if(!months.some(m=>m.id===scoreMonthId)){
    const withData = months.filter(m=> monthHasScores(scoreClassId, m.id));
    scoreMonthId = (withData[withData.length-1] || months[0] || {}).id || '';
  }
  P.innerHTML = pageHead('Scores', `
    <select id="scClass">${options(st.classes, c=>c.id, classLabel, scoreClassId)}</select>
    <select id="scMonth" dir="rtl">${options(months, m=>m.id, m=>m.label, scoreMonthId)}</select>`) + `<div id="scGrid"></div>`;
  $('scClass').addEventListener('change', e=>{ scoreClassId = e.target.value; renderScoresGrid(); });
  $('scMonth').addEventListener('change', e=>{ scoreMonthId = e.target.value; renderScoresGrid(); });
  renderScoresGrid();
}
function renderScoresGrid(){
  const box = $('scGrid'), cls = classById(scoreClassId), month = monthById(scoreMonthId);
  if(!cls || !month){ box.innerHTML = `<div class="empty">${st.classes.length?'Pick a class and month':'Add a class first in Settings → Classes &amp; Staff'}</div>`; return; }
  const rec = getGradeRecord(cls.id, month.id), wc = rec.weekCount, defs = buildColumnDefs(cls, wc), students = sortedStudents(cls.id), gs = groupStarts(defs);
  const label = enName(cls)+' · '+month.label;
  const ro = !canEdit();
  box.innerHTML = `${ro?'<div class="notice">View only</div>':''}<div class="grid-wrap" dir="rtl"><table class="entry rtl ${ro?'ro':''}"><thead>${gridHead(cls, wc, rec.parshiot, !ro)}</thead><tbody>${
    students.length ? students.map((s,r)=>{
      if(!rec.perStudent[s.id]) rec.perStudent[s.id] = emptyStudentRecord(cls);
      const d = ensureRecordShape(rec.perStudent[s.id], cls);
      return `<tr><td class="name">${esc(heName(s))}</td>` + defs.map((def,c)=>{ const v = cellValue(d, def)||''; return `<td class="${validCell(def,v)?'':'bad'}${gs[c]?' gs':''}"><input type="text" inputmode="numeric" data-row="${r}" data-col="${c}" value="${esc(v)}" ${ro?'readonly tabindex="-1"':''}></td>`; }).join('') + '</tr>';
    }).join('') : `<tr><td colspan="${defs.length+1}"><div class="empty">No students in this class</div></td></tr>`
  }</tbody></table></div>`;
  if(ro){ box.querySelectorAll('.parsha').forEach(i=>{ i.readOnly = true; i.tabIndex = -1; }); return; }
  box.querySelectorAll('.parsha').forEach(inp=> inp.addEventListener('input', ()=>{ rec.parshiot[+inp.dataset.idx] = inp.value; saveAll('Scores', label); }));
  box.querySelectorAll('.wk-btn').forEach(b=> b.addEventListener('click', ()=>{ rec.weekCount = b.dataset.wk==='add' ? 5 : 4; saveAll(rec.weekCount===5?'Add week 5':'Remove week 5', label); renderScoresGrid(); }));
  const inputs = Array.from(box.querySelectorAll('tbody input'));
  inputs.forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const r = +inp.dataset.row, c = +inp.dataset.col;
      setCellValue(rec.perStudent[students[r].id], defs[c], inp.value.trim());
      inp.parentElement.classList.toggle('bad', !validCell(defs[c], inp.value));
      saveAll('Scores', label);
    });
    inp.addEventListener('focus', ()=> inp.select());
    inp.addEventListener('keydown', e=>{
      if(['Enter','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){ e.preventDefault(); moveFocus(inp, e.key, inputs, students.length, defs.length, e.shiftKey); }
    });
  });
}
function moveFocus(cur, key, inputs, nRows, nCols, shift){
  const r = +cur.dataset.row, c = +cur.dataset.col; let nr = r, nc = c;
  if(key==='Tab'){ // across (right to left), wraps to the next row
    if(shift){ nc = c-1; if(nc<0){ nc = nCols-1; nr = (r-1+nRows)%nRows; } }
    else { nc = c+1; if(nc>=nCols){ nc = 0; nr = (r+1)%nRows; } }
  }
  else if(key==='Enter'){ nr = shift ? Math.max(0, r-1) : r+1; if(nr>=nRows){ nr = 0; nc = (c+1)%nCols; } }
  else if(key==='ArrowUp') nr = Math.max(0, r-1);
  else if(key==='ArrowDown') nr = Math.min(nRows-1, r+1);
  else if(key==='ArrowLeft') nc = Math.min(nCols-1, c+1);
  else if(key==='ArrowRight') nc = Math.max(0, c-1);
  const t = inputs.find(i=>+i.dataset.row===nr && +i.dataset.col===nc);
  if(t){ t.focus(); t.select(); }
}
