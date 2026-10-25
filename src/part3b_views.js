
/* =====================================================================
   Navigation
   ===================================================================== */
let activeTab = 'dashboard';
let activeSub = 'importexport';
function activateTab(tab){
  if(!canEdit() && ['classes','entry','settings'].includes(tab)) tab = 'dashboard';
  flushNow();
  activeTab = tab;
  document.querySelectorAll('#mainNav button').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('section.panel').forEach(p=>p.classList.toggle('active', p.id==='panel-'+tab));
  renderActive();
}
function renderActive(){
  if(activeTab==='dashboard') renderDashboard();
  if(activeTab==='classes') renderClasses();
  if(activeTab==='entry') renderEntry();
  if(activeTab==='reports') renderReports();
  if(activeTab==='settings') activateSub(activeSub);
}
function afterDataChange(){ renderActive(); }
document.querySelectorAll('#mainNav button').forEach(b=> b.addEventListener('click', ()=>activateTab(b.dataset.tab)));
function isSubActive(sub){ return activeTab==='settings' && activeSub===sub; }

/* =====================================================================
   Averages
   ===================================================================== */
function avgOf(arr){
  const nums = arr.filter(v=>v!==''&&v!=null).map(Number).filter(n=>!isNaN(n));
  return nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : null;
}
function weekVals(d, cls, wc){
  const vals = [];
  cls.subjects.filter(s=>s.kind==='week').forEach(s=> (d.week[s.id]||[]).slice(0,wc).forEach(v=>{ if(v!=='') vals.push(Number(v)); }));
  return vals;
}
function studentOverallAvg(d, cls, wc){
  const w = avgOf(weekVals(d, cls, wc));
  const c = avgOf(cls.subjects.filter(s=>s.kind==='cat').map(s=> d.cat[s.id]==='' || d.cat[s.id]===undefined ? '' : Number(d.cat[s.id])*10));
  return avgOf([w, c].filter(v=>v!==null));
}
function recFor(classId, monthId){ const r = st.grades[gradeKey(classId, monthId)]; return r ? ensureGradeRec(r) : null; }
function studentYearAvg(cls, sid){
  const vals = [];
  sortedMonths().forEach(m=>{
    const rec = recFor(cls.id, m.id); const d = rec && rec.perStudent[sid]; if(!d) return;
    ensureRecordShape(d, cls);
    const v = studentOverallAvg(d, cls, rec.weekCount); if(v!==null) vals.push(v);
  });
  return avgOf(vals);
}
function unionSubjects(){
  const map = new Map();
  st.classes.forEach(c=> (c.subjects||[]).forEach(s=>{ const key = s.kind+'::'+s.label; if(!map.has(key)) map.set(key, {kind:s.kind, label:s.label}); }));
  return Array.from(map.values());
}
function classSubjectYearAvg(cls, subj){
  const match = (cls.subjects||[]).find(s=>s.kind===subj.kind && s.label===subj.label);
  if(!match) return null;
  const monthly = [];
  sortedMonths().forEach(m=>{
    const rec = recFor(cls.id, m.id); if(!rec) return;
    const vals = [];
    (st.students[cls.id]||[]).forEach(s=>{
      const d = rec.perStudent[s.id]; if(!d) return;
      ensureRecordShape(d, cls);
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

/* =====================================================================
   Dashboard
   ===================================================================== */
function scoreClass(v){ const T = st.dashboardThresholds; if(v===null) return ''; if(v>=T.high) return 'cell-good'; if(v>=T.low) return 'cell-mid'; return 'cell-bad'; }
function emptyTable(table, text){ table.innerHTML = `<tbody><tr><td style="border:none;padding:0;"><div class="empty-state">${esc(text)}</div></td></tr></tbody>`; }
function renderDashboard(){
  const T = st.dashboardThresholds;
  $('dashYear').textContent = st.currentYear;
  document.querySelectorAll('.thr-input').forEach(i=>{ if(document.activeElement!==i) i.value = T[i.dataset.thr]; });

  let nStudents = 0; const allAvgs = [];
  const low = [];
  st.classes.forEach(cls=>{
    ensureClassShape(cls);
    (st.students[cls.id]||[]).forEach(s=>{
      nStudents++;
      const a = studentYearAvg(cls, s.id);
      if(a!==null){ allAvgs.push(a); if(a < T.low) low.push({cls, s, avg:a}); }
    });
  });
  $('statStudents').textContent = nStudents;
  $('statClasses').textContent = st.classes.length;
  const ya = avgOf(allAvgs); $('statAvg').textContent = ya===null ? '—' : Math.round(ya);
  $('statMonths').textContent = sortedMonths().filter(m=> st.classes.some(c=>{ const r = recFor(c.id, m.id); return r && Object.values(r.perStudent).some(hasAnyScore); })).length;

  low.sort((a,b)=>a.avg-b.avg);
  $('lowStudentsCount').textContent = low.length;
  if(!low.length) emptyTable($('lowStudentsTable'), 'None');
  else $('lowStudentsTable').innerHTML = '<thead><tr><th>Student</th><th>Class</th><th>Average</th></tr></thead><tbody>' +
    low.map(r=>`<tr class="clickable" data-cls="${esc(r.cls.id)}" data-sid="${esc(r.s.id)}"><td class="namecol"><bdi>${esc(r.s.name)}</bdi></td><td><bdi>${esc(r.cls.name)}</bdi></td><td class="cell-bad">${Math.round(r.avg)}</td></tr>`).join('') + '</tbody>';

  const lowS = [], highS = [];
  unionSubjects().forEach(subj=> st.classes.forEach(cls=>{
    const a = classSubjectYearAvg(cls, subj); if(a===null) return;
    const row = {subject:subj.label, cls, avg:a};
    if(a < T.low) lowS.push(row); if(a >= T.high) highS.push(row);
  }));
  lowS.sort((a,b)=>a.avg-b.avg); highS.sort((a,b)=>b.avg-a.avg);
  $('lowSubjectsCount').textContent = lowS.length; $('highSubjectsCount').textContent = highS.length;
  const subjTable = (table, rows, klass)=>{
    if(!rows.length) return emptyTable(table, 'None');
    table.innerHTML = '<thead><tr><th>Subject</th><th>Class</th><th>Average</th></tr></thead><tbody>' +
      rows.map(r=>`<tr><td class="namecol"><bdi>${esc(r.subject)}</bdi></td><td><bdi>${esc(r.cls.name)}</bdi></td><td class="${klass}">${Math.round(r.avg)}</td></tr>`).join('') + '</tbody>';
  };
  subjTable($('lowClassSubjectTable'), lowS, 'cell-bad');
  subjTable($('highClassSubjectTable'), highS, 'cell-good');

  const totals = [];
  st.classes.forEach(cls=> (st.students[cls.id]||[]).forEach(s=>{
    let ab = 0, la = 0;
    sortedMonths().forEach(m=>{
      const rec = recFor(cls.id, m.id); const d = rec && rec.perStudent[s.id]; if(!d) return;
      if(d.chesarim!=='' && !isNaN(Number(d.chesarim))) ab += Number(d.chesarim);
      if(d.ichurim!=='' && !isNaN(Number(d.ichurim))) la += Number(d.ichurim);
    });
    totals.push({cls, s, ab, la});
  }));
  const att = (table, countEl, key, thr, klass)=>{
    const rows = totals.filter(r=>r[key] > thr).sort((a,b)=>b[key]-a[key]);
    $(countEl).textContent = rows.length;
    if(!rows.length) return emptyTable(table, 'None');
    table.innerHTML = '<thead><tr><th>Student</th><th>Class</th><th>Total</th></tr></thead><tbody>' +
      rows.map(r=>`<tr class="clickable" data-cls="${esc(r.cls.id)}" data-sid="${esc(r.s.id)}"><td class="namecol"><bdi>${esc(r.s.name)}</bdi></td><td><bdi>${esc(r.cls.name)}</bdi></td><td class="${klass}">${r[key]}</td></tr>`).join('') + '</tbody>';
  };
  att($('topAbsencesTable'), 'absenceCount', 'ab', T.absences, 'cell-bad');
  att($('topLatesTable'), 'lateCount', 'la', T.lates, 'cell-mid');
}
document.querySelectorAll('.thr-input').forEach(inp=>{
  inp.addEventListener('input', ()=>{
    const key = inp.dataset.thr;
    const v = Math.max(0, Math.floor(Number(inp.value)||0));
    st.dashboardThresholds[key] = v;
    document.querySelectorAll(`.thr-input[data-thr="${key}"]`).forEach(o=>{ if(o!==inp) o.value = v; });
    saveAll('Dashboard limits');
    renderDashboard();
  });
});
$('panel-dashboard').addEventListener('click', e=>{
  const tr = e.target.closest('tr.clickable'); if(!tr) return;
  openStudentReport(tr.dataset.cls, tr.dataset.sid);
});

/* =====================================================================
   Classes
   ===================================================================== */
let activeClassId = null;
function findOrCreateClass(name, teacher){
  name = String(name||'').trim(); if(!name) return null;
  let cls = st.classes.find(c=>c.name===name);
  if(!cls){ cls = {id:uid(), name, teacher: teacher||'', subjects: defaultSubjects()}; st.classes.push(cls); st.students[cls.id] = []; }
  else if(teacher && !cls.teacher) cls.teacher = teacher;
  return ensureClassShape(cls);
}
function findOrCreateStudent(classId, name){
  name = String(name||'').trim(); if(!name) return null;
  st.students[classId] = st.students[classId] || [];
  let s = st.students[classId].find(x=>x.name===name);
  if(!s){ s = {id:uid(), name}; st.students[classId].push(s); }
  return s;
}
function inlineEdit(cell, value, onDone){
  cell.innerHTML = '';
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = value; inp.dir = 'rtl'; inp.className = 'inline-input';
  cell.appendChild(inp); inp.focus(); inp.select();
  let done = false;
  const finish = ok=>{ if(done) return; done = true; const v = inp.value.trim(); onDone(ok && v && v!==value ? v : null); };
  inp.addEventListener('keydown', e=>{ if(e.key==='Enter') finish(true); if(e.key==='Escape') finish(false); });
  inp.addEventListener('blur', ()=>finish(true));
}

function renderClasses(){
  if(activeClassId && !st.classes.some(c=>c.id===activeClassId)) activeClassId = null;
  if(!activeClassId && st.classes.length) activeClassId = st.classes[0].id;
  $('classCount').textContent = st.classes.length;
  $('addClassBtn').innerHTML = ICON.plus;
  $('classList').innerHTML = st.classes.length ? st.classes.map(c=>{
    const n = (st.students[c.id]||[]).length;
    return `<button type="button" class="class-item ${c.id===activeClassId?'active':''}" data-id="${esc(c.id)}"><span class="class-name"><bdi>${esc(c.name)}</bdi></span><span class="class-meta"><bdi>${esc(c.teacher||'')}</bdi>${c.teacher?' · ':''}${n} תלמידים</span></button>`;
  }).join('') : '<div class="empty-state">—</div>';
  renderClassDetail();
}
$('classList').addEventListener('click', e=>{ const b = e.target.closest('.class-item'); if(!b) return; activeClassId = b.dataset.id; renderClasses(); });
function addClass(){
  const name = $('newClassName').value.trim(), teacher = $('newClassTeacher').value.trim();
  if(!name){ $('newClassName').focus(); return; }
  if(st.classes.some(c=>c.name===name)){ $('newClassName').select(); return; }
  const cls = findOrCreateClass(name, teacher);
  $('newClassName').value = ''; $('newClassTeacher').value = '';
  activeClassId = cls.id;
  saveAll('Add class', name);
  renderClasses();
}
$('addClassBtn').addEventListener('click', addClass);
['newClassName','newClassTeacher'].forEach(id=> $(id).addEventListener('keydown', e=>{ if(e.key==='Enter') addClass(); }));

function renderClassDetail(){
  const box = $('classDetail');
  const cls = st.classes.find(c=>c.id===activeClassId);
  if(!cls){ box.innerHTML = ''; return; }
  ensureClassShape(cls);
  const list = st.students[cls.id] || [];
  box.innerHTML = `
    <div class="card">
      <div class="class-detail-head">
        <input type="text" id="editClassName" value="${esc(cls.name)}" dir="rtl" style="width:140px;">
        <input type="text" id="editClassTeacher" value="${esc(cls.teacher||'')}" placeholder="Teacher" dir="rtl" style="flex:1; min-width:160px; font-weight:400;">
        ${iconBtn('trash','Delete class','id="deleteClassBtn"','danger')}
      </div>
    </div>
    <div class="two-cols">
      <div class="card">
        <div class="card-head"><h2>תלמידים</h2><span class="count-pill">${list.length}</span></div>
        <div class="add-row" style="margin:0 0 10px;"><input type="text" id="newStudentName" placeholder="שם התלמיד" dir="rtl">${iconBtn('plus','Add student','id="addStudentBtn"','add')}</div>
        ${list.length ? `<table class="list"><tbody>${list.map((s,i)=>`<tr data-sid="${esc(s.id)}"><td class="num">${i+1}</td><td class="name"><bdi>${esc(s.name)}</bdi></td><td class="actions">${iconBtn('edit','Rename','data-act="ren-stu"')}${iconBtn('trash','Remove','data-act="del-stu"','danger')}</td></tr>`).join('')}</tbody></table>` : ''}
      </div>
      <div class="card">
        <div class="card-head"><h2>מקצועות</h2>${iconBtn('reset','Reset to default subjects','id="resetSubjectsBtn"')}</div>
        <div class="add-row" style="margin:0 0 10px;">
          <input type="text" id="newSubjectLabel" placeholder="מקצוע" dir="rtl">
          <select id="newSubjectKind"><option value="week">שבועי</option><option value="cat">חודשי</option></select>
          ${iconBtn('plus','Add subject','id="addSubjectBtn"','add')}
        </div>
        <table class="list"><tbody>${cls.subjects.map(s=>`<tr data-subj="${esc(s.id)}"><td class="name"><bdi>${esc(s.label)}</bdi></td><td style="width:1%;"><span class="kind-badge ${s.kind}">${s.kind==='week'?'שבועי':'חודשי'}</span></td><td class="actions">${iconBtn('edit','Rename','data-act="ren-sub"')}${iconBtn('trash','Remove','data-act="del-sub"','danger')}</td></tr>`).join('')}</tbody></table>
      </div>
    </div>`;

  const nameInp = $('editClassName'), teachInp = $('editClassTeacher');
  nameInp.addEventListener('change', ()=>{
    const v = nameInp.value.trim();
    if(!v || st.classes.some(c=>c.id!==cls.id && c.name===v)){ nameInp.value = cls.name; return; }
    const old = cls.name; cls.name = v; saveAll('Rename class', old+' → '+v); renderClasses();
  });
  teachInp.addEventListener('change', ()=>{ cls.teacher = teachInp.value.trim(); saveAll('Change teacher', cls.name+' · '+cls.teacher); renderClasses(); });
  $('deleteClassBtn').addEventListener('click', async ()=>{
    if(!await askConfirm('Delete class '+cls.name+'?', 'All its students, scores and attendance will be removed.')) return;
    st.classes = st.classes.filter(c=>c.id!==cls.id);
    delete st.students[cls.id];
    Object.keys(st.grades).forEach(k=>{ if(k.startsWith(cls.id+'::')) delete st.grades[k]; });
    activeClassId = null;
    saveAll('Delete class', cls.name); doneWithUndo('Class '+cls.name+' deleted');
    renderClasses();
  });

  const addStudent = ()=>{
    const inp = $('newStudentName'), v = inp.value.trim();
    if(!v){ inp.focus(); return; }
    if(list.some(s=>s.name===v)){ inp.select(); return; }
    findOrCreateStudent(cls.id, v);
    saveAll('Add student', v+' · '+cls.name);
    renderClasses(); $('newStudentName').focus();
  };
  $('addStudentBtn').addEventListener('click', addStudent);
  $('newStudentName').addEventListener('keydown', e=>{ if(e.key==='Enter') addStudent(); });

  const addSubject = ()=>{
    const inp = $('newSubjectLabel'), v = inp.value.trim(), kind = $('newSubjectKind').value;
    if(!v){ inp.focus(); return; }
    if(cls.subjects.some(s=>s.label===v)){ inp.select(); return; }
    cls.subjects.push({id:uid(), label:v, kind});
    saveAll('Add subject', v+' · '+cls.name);
    renderClasses();
  };
  $('addSubjectBtn').addEventListener('click', addSubject);
  $('newSubjectLabel').addEventListener('keydown', e=>{ if(e.key==='Enter') addSubject(); });
  $('resetSubjectsBtn').addEventListener('click', async ()=>{
    if(!await askConfirm('Reset subjects for '+cls.name+'?', '', 'Reset')) return;
    cls.subjects = defaultSubjects(); saveAll('Reset subjects', cls.name); doneWithUndo('Subjects reset'); renderClasses();
  });

  box.querySelectorAll('[data-act]').forEach(btn=> btn.addEventListener('click', async ()=>{
    const act = btn.dataset.act, tr = btn.closest('tr');
    if(act==='ren-stu' || act==='del-stu'){
      const s = list.find(x=>x.id===tr.dataset.sid); if(!s) return;
      if(act==='ren-stu') return inlineEdit(tr.querySelector('.name'), s.name, v=>{ if(v){ const old = s.name; s.name = v; saveAll('Rename student', old+' → '+v); } renderClasses(); });
      if(!await askConfirm('Remove '+s.name+'?', 'Their scores and attendance will be removed.', 'Remove')) return;
      st.students[cls.id] = list.filter(x=>x.id!==s.id);
      Object.keys(st.grades).forEach(k=>{ if(k.startsWith(cls.id+'::')) delete st.grades[k].perStudent[s.id]; });
      saveAll('Remove student', s.name+' · '+cls.name); doneWithUndo(s.name+' removed');
      renderClasses();
    } else {
      const sub = cls.subjects.find(x=>x.id===tr.dataset.subj); if(!sub) return;
      if(act==='ren-sub') return inlineEdit(tr.querySelector('.name'), sub.label, v=>{ if(v && !cls.subjects.some(x=>x.label===v)){ const old = sub.label; sub.label = v; saveAll('Rename subject', old+' → '+v+' · '+cls.name); } renderClasses(); });
      if(cls.subjects.length<=1) return;
      if(!await askConfirm('Remove subject '+sub.label+'?', '', 'Remove')) return;
      cls.subjects = cls.subjects.filter(x=>x.id!==sub.id);
      saveAll('Remove subject', sub.label+' · '+cls.name); doneWithUndo(sub.label+' removed');
      renderClasses();
    }
  }));
}

/* =====================================================================
   Scores grid (Hebrew, as before)
   ===================================================================== */
function buildColumnDefs(cls, wc){
  const defs = [{type:'chesarim'},{type:'ichurim'},{type:'yatza'}];
  cls.subjects.filter(s=>s.kind==='cat').forEach(s=> defs.push({type:'cat', id:s.id}));
  const ws = cls.subjects.filter(s=>s.kind==='week');
  for(let w=0; w<wc; w++) ws.forEach(s=> defs.push({type:'week', id:s.id, week:w}));
  return defs;
}
function validCell(def, raw){
  const v = String(raw??'').trim(); if(v==='') return true;
  const n = Number(v); if(isNaN(n)) return false;
  if(def.type==='cat') return n>=1 && n<=10;
  if(def.type==='week') return n>=0 && n<=100;
  return Number.isInteger(n) && n>=0;
}
function cellValue(d, def){
  if(def.type==='cat') return d.cat[def.id];
  if(def.type==='week') return d.week[def.id][def.week];
  return d[def.type];
}
function setCellValue(d, def, v){
  if(def.type==='cat') d.cat[def.id] = v;
  else if(def.type==='week') d.week[def.id][def.week] = v;
  else d[def.type] = v;
}
function renderEntry(){
  fillSelect($('entryClassSelect'), st.classes, c=>c.id, c=>c.name+(c.teacher?' ('+c.teacher+')':''));
  fillSelect($('entryMonthSelect'), sortedMonths(), m=>m.id, m=>m.label);
  $('tabModeSelect').value = st.tabMode;
  renderEntryGrid();
}
$('entryClassSelect').addEventListener('change', ()=>{ flushNow(); renderEntryGrid(); });
$('entryMonthSelect').addEventListener('change', ()=>{ flushNow(); renderEntryGrid(); });
$('tabModeSelect').addEventListener('change', e=>{ st.tabMode = e.target.value; saveAll('Tab direction', e.target.value); });

function renderEntryGrid(){
  const classId = $('entryClassSelect').value, monthId = $('entryMonthSelect').value;
  const card = $('entryGridCard');
  const cls = st.classes.find(c=>c.id===classId), month = st.months.find(m=>m.id===monthId);
  if(!cls || !month){ card.style.display = 'none'; return; }
  card.style.display = 'block';
  ensureClassShape(cls);
  const rec = getGradeRecord(classId, monthId);
  const wc = rec.weekCount;
  const catS = cls.subjects.filter(s=>s.kind==='cat'), weekS = cls.subjects.filter(s=>s.kind==='week');
  const defs = buildColumnDefs(cls, wc);
  const label = `${cls.name} · ${month.label}`;

  let g = `<tr class="group"><th rowspan="2">תלמיד</th><th colspan="3">נוכחות</th>`;
  if(catS.length) g += `<th colspan="${catS.length}">ניקוד (1–10)</th>`;
  for(let w=0; w<wc; w++){
    if(!weekS.length) continue;
    let ctl = '';
    if(w===wc-1 && wc<5) ctl = `<button type="button" class="wk-btn" data-wk="add" data-tip="Add week 5">+</button>`;
    if(w===4) ctl = `<button type="button" class="wk-btn" data-wk="remove" data-tip="Remove week 5">×</button>`;
    g += `<th colspan="${weekS.length}" class="parasha-head"><div class="wk">שבוע ${w+1} ${ctl}</div><input type="text" class="parashaName" data-idx="${w}" placeholder="פרשה" value="${esc(rec.parshiot[w]||'')}"></th>`;
  }
  g += '</tr>';
  let sub = '<tr><th>חסר</th><th>איחור</th><th>יצא מוקדם</th>' + catS.map(s=>`<th>${esc(s.label)}</th>`).join('');
  for(let w=0; w<wc; w++) sub += weekS.map(s=>`<th>${esc(s.label)}</th>`).join('');
  $('entryThead').innerHTML = g + sub + '</tr>';

  const students = st.students[classId] || [];
  $('entryTbody').innerHTML = students.length ? students.map((s, r)=>{
    if(!rec.perStudent[s.id]) rec.perStudent[s.id] = emptyStudentRecord(cls);
    const d = ensureRecordShape(rec.perStudent[s.id], cls);
    return `<tr><td class="name-cell"><bdi>${esc(s.name)}</bdi></td>` + defs.map((def, c)=>{
      const v = cellValue(d, def) || '';
      return `<td class="${validCell(def, v)?'':'bad'}"><input type="text" inputmode="numeric" data-row="${r}" data-col="${c}" value="${esc(v)}"></td>`;
    }).join('') + '</tr>';
  }).join('') : `<tr><td colspan="${defs.length+1}"><div class="empty-state">—</div></td></tr>`;

  $('entryThead').querySelectorAll('.parashaName').forEach(inp=> inp.addEventListener('input', ()=>{ rec.parshiot[+inp.dataset.idx] = inp.value; saveAll('Scores', label); }));
  $('entryThead').querySelectorAll('.wk-btn').forEach(b=> b.addEventListener('click', ()=>{
    rec.weekCount = b.dataset.wk==='add' ? 5 : 4;
    saveAll(rec.weekCount===5 ? 'Add week 5' : 'Remove week 5', label);
    renderEntryGrid();
  }));
  const inputs = Array.from($('entryTbody').querySelectorAll('input'));
  inputs.forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const r = +inp.dataset.row, c = +inp.dataset.col;
      const d = rec.perStudent[students[r].id];
      setCellValue(d, defs[c], inp.value.trim());
      inp.parentElement.classList.toggle('bad', !validCell(defs[c], inp.value));
      saveAll('Scores', label);
    });
    inp.addEventListener('focus', ()=> inp.select());
    inp.addEventListener('keydown', e=>{
      if(['Enter','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
        e.preventDefault(); moveFocus(inp, e.key, inputs, students.length, defs.length, e.shiftKey);
      }
    });
  });
}
function moveFocus(cur, key, inputs, nRows, nCols, shift){
  const r = +cur.dataset.row, c = +cur.dataset.col;
  let nr = r, nc = c;
  const nextRow = ()=>{ nc = c+1; if(nc>=nCols){ nc = 0; nr = (r+1)%nRows; } };
  const prevRow = ()=>{ nc = c-1; if(nc<0){ nc = nCols-1; nr = (r-1+nRows)%nRows; } };
  const nextCol = ()=>{ nr = r+1; if(nr>=nRows){ nr = 0; nc = (c+1)%nCols; } };
  const prevCol = ()=>{ nr = r-1; if(nr<0){ nr = nRows-1; nc = (c-1+nCols)%nCols; } };
  if(key==='Enter') nextCol();
  else if(key==='Tab'){ if(st.tabMode==='col'){ shift?prevCol():nextCol(); } else { shift?prevRow():nextRow(); } }
  else if(key==='ArrowUp') nr = Math.max(0, r-1);
  else if(key==='ArrowDown') nr = Math.min(nRows-1, r+1);
  else if(key==='ArrowLeft') nc = Math.min(nCols-1, c+1);
  else if(key==='ArrowRight') nc = Math.max(0, c-1);
  const t = inputs.find(i=>+i.dataset.row===nr && +i.dataset.col===nc);
  if(t){ t.focus(); t.select(); }
}
