
/* =====================================================================
   Reports – Hebrew, one fixed letter-size page each.
   The letterhead always fills the page; long content shrinks to fit.
   ===================================================================== */
function fitReports(root){
  (root||document).querySelectorAll('.report-page').forEach(pg=>{
    const body = pg.querySelector('.report-body'), c = pg.querySelector('.report-content'); if(!body || !c) return;
    c.style.zoom = '';
    const H = body.clientHeight, h = c.scrollHeight;
    if(h > H && H > 0) c.style.zoom = (H/h).toFixed(3);
  });
}
const FIT_SCRIPT = 'window.__fit=' + fitReports.toString().replace(/^function fitReports/, 'function') + ';';
function sizeVars(){ return Object.keys(st.sizes).map(k=>`--r-${k}-size:${st.sizes[k]}px`).join(';'); }
function reportText(key, ctx){ let t = String(st.reportText[key] ?? ''); Object.entries(ctx||{}).forEach(([k,v])=>{ t = t.split('{'+k+'}').join(v ?? ''); }); return t; }
const rtHtml = (key, ctx) => esc(reportText(key, ctx)).replace(/\n/g,'<br>');
function reportPageHtml(cls, month, s, rec, opt){
  opt = opt || {};
  ensureClassShape(cls);
  const wc = rec ? rec.weekCount : 4;
  const d = ensureRecordShape(rec && rec.perStudent[s.id] ? clone(rec.perStudent[s.id]) : emptyStudentRecord(cls), cls);
  const par = rec ? rec.parshiot : [];
  const weekS = cls.subjects.filter(x=>x.kind==='week'), catS = cls.subjects.filter(x=>x.kind==='cat');
  const ctx = {month: month ? month.label : '', student: heName(s), class: heName(cls), teacher: heName(teacherOf(cls))};
  let weekHtml = '';
  if(weekS.length){
    let rows = '';
    for(let i=0;i<wc;i++){
      const any = weekS.some(w=> ((d.week[w.id]||[])[i]||'')!=='');
      if(!par[i] && !any) continue;
      rows += `<tr><td>${esc(par[i]||('שבוע '+(i+1)))}</td>${weekS.map(w=>`<td>${esc((d.week[w.id]||[])[i]||'')}</td>`).join('')}</tr>`;
    }
    if(!rows) rows = `<tr><td colspan="${weekS.length+1}">—</td></tr>`;
    weekHtml = `<table class="rtab"><tr><th>${esc(st.reportText.weekHeader)}</th>${weekS.map(w=>`<th>${esc(w.label)}</th>`).join('')}</tr>${rows}</table>`;
  }
  const catHtml = catS.length ? `<div class="catline">${rtHtml('scoreNote',ctx)}</div><table class="rtab"><tr>${catS.map(c=>`<th>${esc(c.label)}</th>`).join('')}</tr><tr>${catS.map(c=>`<td>${esc(d.cat[c.id]||'')}</td>`).join('')}</tr></table>` : '';
  const L = st.layout;
  const lh = opt.letterhead ? `background-image:url('${currentLetterheadDataUrl}');` : '';
  return `<div class="report-page" style="${lh}${sizeVars()}">
    <div class="report-body" style="top:${L.topMM}mm;bottom:${L.bottomMM}mm;left:${L.leftMM}mm;right:${L.rightMM}mm;"><div class="report-content">
      <div class="bsd">בס"ד</div>
      <div class="title">${rtHtml('title',ctx)}</div>
      <p class="lead">${rtHtml('lead',ctx)}</p>
      <div class="sname">${esc(heName(s))}</div>
      <div class="cline">${rtHtml('classLine',ctx)}</div>
      <div class="note">${rtHtml('note',ctx)}</div>
      ${weekHtml}${catHtml}
      <table class="rtab"><tr><th>${esc(st.reportText.lateHeader)}</th><th>${esc(st.reportText.absentHeader)}</th><th>${esc(st.reportText.earlyHeader)}</th></tr>
        <tr><td>${esc(d.ichurim||'')}</td><td>${esc(d.chesarim||'')}</td><td>${esc(d.yatza||'')}</td></tr></table>
      <div class="signline"><span>${rtHtml('signature',ctx)}</span><span class="rule"></span></div>
    </div></div>${opt.copyMark?`<div class="copy-mark">${esc(opt.copyMark)}</div>`:''}
  </div>`;
}
function showPreview(box, pageHtml){
  box.innerHTML = `<div class="pv-outer" style="position:relative;width:100%;"><div class="pv-inner" style="transform-origin:top left;width:8.5in;">${pageHtml}</div></div>`;
  const outer = box.querySelector('.pv-outer'), inner = box.querySelector('.pv-inner');
  const scale = ()=>{ fitReports(inner); const w = outer.clientWidth || 600, sc = Math.min(1, w/816); inner.style.transform = `scale(${sc})`; outer.style.height = (1056*sc)+'px'; };
  scale();
  if(document.fonts) document.fonts.ready.then(scale);
}
function reportCss(){
  return Array.from(document.querySelectorAll('style')).map(s=>s.textContent).join('\n') + `
    body{background:#fff; margin:0;} .report-page{page-break-after:always;} .report-page:last-child{page-break-after:auto;}
    @page{margin:0; size:letter;}`;
}
function reportsHtml(items, opt){ return items.map(r=>reportPageHtml(r.cls, r.month, r.s, r.rec, opt)).join(''); }
function printReports(items, opt){ const h = reportsHtml(items, opt); if(h) printHtml('Reports', `<style>${reportCss()}</style>`, h, FIT_SCRIPT); }
function downloadReports(items, opt, name){ const h = reportsHtml(items, opt); if(h) downloadPdf(name+'.pdf', h, {selector:'.report-page'}); }

/* ---------- approval status ---------- */
function classMonthSig(cls, monthId){
  const rec = recFor(cls.id, monthId);
  return hashStr(JSON.stringify([rec ? {p:rec.parshiot, w:rec.weekCount, d:studentsOf(cls.id).map(s=>rec.perStudent[s.id]||null)} : null, studentsOf(cls.id).map(s=>heName(s)), cls.subjects, heName(cls), heName(teacherOf(cls))]));
}
function reportState(cls, monthId){
  const r = st.reportStatus[gradeKey(cls.id, monthId)];
  if(!r) return 'none';
  if(r.status==='approved') return r.sig===classMonthSig(cls, monthId) ? 'approved' : 'changed';
  return 'sent';
}
const REP_TAG = {none:'<span class="tag">Not printed</span>', sent:'<span class="tag wait">Sent to teacher</span>', approved:'<span class="tag ok">Approved</span>', changed:'<span class="tag warn">Changed after approval</span>'};

/* ---------- page: a box per month, like Assessments ---------- */
let repMonthId = '', repSel = null;   // {classId, idx}
function classItems(cls, monthId){ const m = monthById(monthId), rec = recFor(cls.id, monthId); return studentsOf(cls.id).map(s=>({cls, month:m, s, rec})); }
const repClasses = () => st.classes.filter(c=>studentsOf(c.id).length);
function approvedItems(monthId){ const out = []; repClasses().forEach(c=>{ if(reportState(c, monthId)==='approved') out.push(...classItems(c, monthId)); }); return out; }
const lhOpt = () => ({letterhead: st.printLetterhead});
function renderReports(){
  const P = $('panel-reports'), months = sortedMonths(), classes = repClasses();
  if(!months.some(m=>m.id===repMonthId)){
    const withStatus = months.filter(m=> classes.some(c=>st.reportStatus[gradeKey(c.id, m.id)]));
    const withData = months.filter(m=> classes.some(c=>monthHasScores(c.id, m.id)));
    repMonthId = (withStatus[withStatus.length-1] || withData[withData.length-1] || months[0] || {}).id || '';
  }
  if(repSel && (!classById(repSel.classId))) repSel = null;
  const cards = months.map(m=>{
    const states = classes.map(c=>reportState(c, m.id));
    const ap = states.filter(s=>s==='approved').length, sent = states.filter(s=>s==='sent').length, ch = states.filter(s=>s==='changed').length;
    const scored = classes.filter(c=>monthHasScores(c.id, m.id)).length;
    const sub = !scored ? 'No scores yet' : `${ap}/${classes.length} approved${sent?` · ${sent} sent`:''}${ch?` · ${ch} changed`:''}`;
    const dis = ap ? '' : 'disabled';
    return `<div class="mcard ${m.id===repMonthId?'sel':''} ${ch?'stale':''}" data-m="${m.id}"><div class="m">${esc(m.label)}</div><div class="s">${sub}</div>
      <div class="acts">${iconBtn('view','Open this month','data-mact="open"')}${canEdit()||true?`<button type="button" class="icon-btn" data-tip="${ap?'Print approved reports':'Nothing approved yet'}" data-mact="print" ${dis}>${ICON.print}</button><button type="button" class="icon-btn" data-tip="${ap?'Download approved as PDF':'Nothing approved yet'}" data-mact="pdf" ${dis}>${ICON.download}</button>`:''}${ap?`<span class="tag ok" style="margin-left:auto;">${ap}</span>`:''}</div></div>`;
  }).join('');
  const month = monthById(repMonthId);
  const table = month ? `<div class="card"><div class="card-head"><h2 class="he">${esc(month.label)}</h2></div>${classes.length ? `<table class="t"><thead><tr><th>Class</th><th>Teacher</th><th>Scores</th><th>Status</th><th></th></tr></thead><tbody>${classes.map(c=>{
      const n = studentsOf(c.id).length, rec = recFor(c.id, month.id), filled = rec ? studentsOf(c.id).filter(s=>hasAnyScore(rec.perStudent[s.id])).length : 0;
      const stt = reportState(c, month.id), ok = stt==='approved';
      return `<tr data-cid="${esc(c.id)}" class="click ${repSel&&repSel.classId===c.id?'sel':''}"><td>${esc(enName(c))} ${c.nameHe?`<span class="muted">· ${he(c.nameHe)}</span>`:''}</td><td>${he(heName(teacherOf(c)))}</td>
        <td><span class="${filled===n?'':'muted'}">${filled}/${n}</span></td><td>${REP_TAG[stt]}</td>
        <td class="act">${iconBtn('view','Preview','data-ract="preview"')}
          ${canEdit()?`<button class="btn sm sec" data-ract="teacher" data-tip="Print for the teacher to check">${ICON.print}Teacher copy</button>
          ${ok ? iconBtn('ban','Remove approval','data-ract="unapprove"') : `<button class="btn sm ok" data-ract="approve">${ICON.check}Approve</button>`}`:''}
          <button type="button" class="icon-btn" data-ract="print" ${ok||!canEdit()?'':'disabled'} data-tip="${ok||!canEdit()?'Print':'Approve first'}">${ICON.print}</button>
          <button type="button" class="icon-btn" data-ract="pdf" ${ok||!canEdit()?'':'disabled'} data-tip="${ok||!canEdit()?'Download PDF':'Approve first'}">${ICON.download}</button></td></tr>`;
    }).join('')}</tbody></table>` : '<div class="empty">No classes with students</div>'}</div>` : '';
  P.innerHTML = pageHead('Reports', `<select id="repLh"><option value="with">With letterhead</option><option value="without">Without letterhead</option></select>`) +
    `<div class="month-cards">${cards}</div>${table}<div id="repPreviewCard"></div>`;
  $('repLh').value = st.printLetterhead ? 'with' : 'without';
  $('repLh').addEventListener('change', e=>{ st.printLetterhead = e.target.value==='with'; saveAll('Letterhead on reports', e.target.value); renderRepPreview(); });
  P.querySelectorAll('.mcard').forEach(card=> card.addEventListener('click', e=>{ if(e.target.closest('button')) return; repMonthId = card.dataset.m; repSel = null; renderReports(); }));
  P.querySelectorAll('[data-mact]').forEach(b=> b.addEventListener('click', e=>{
    e.stopPropagation();
    const m = monthById(b.closest('.mcard').dataset.m), a = b.dataset.mact;
    if(a==='open'){ repMonthId = m.id; repSel = null; renderReports(); return; }
    const items = approvedItems(m.id); if(!items.length) return;
    if(a==='print') printReports(items, lhOpt()); else downloadReports(items, lhOpt(), 'Reports '+m.label);
  }));
  P.querySelectorAll('[data-ract]').forEach(b=> b.addEventListener('click', e=>{
    e.stopPropagation();
    const cls = classById(b.closest('tr').dataset.cid), key = gradeKey(cls.id, month.id), lbl = enName(cls)+' · '+month.label, a = b.dataset.ract;
    if(a==='preview'){ repSel = {classId: cls.id, idx:0}; renderReports(); setTimeout(()=>$('repPreviewCard').scrollIntoView({behavior:'smooth'}), 30); }
    else if(a==='teacher'){
      printReports(classItems(cls, month.id), {letterhead:false, copyMark:'עותק לאישור – '+heName(teacherOf(cls))});
      if(reportState(cls, month.id)!=='approved'){ st.reportStatus[key] = {status:'sent', at:Date.now()}; saveAll('Teacher copy printed', lbl); renderReports(); }
    }
    else if(a==='approve'){ st.reportStatus[key] = {status:'approved', at:Date.now(), sig:classMonthSig(cls, month.id)}; saveAll('Reports approved', lbl); doneWithUndo(enName(cls)+' approved'); renderReports(); }
    else if(a==='unapprove'){ st.reportStatus[key] = {status:'sent', at:Date.now()}; saveAll('Approval removed', lbl); doneWithUndo('Approval removed'); renderReports(); }
    else if(a==='print') printReports(classItems(cls, month.id), lhOpt());
    else if(a==='pdf') downloadReports(classItems(cls, month.id), lhOpt(), 'Reports '+enName(cls)+' '+month.label);
  }));
  P.querySelectorAll('tbody tr[data-cid]').forEach(tr=> tr.addEventListener('click', ()=>{ repSel = {classId: tr.dataset.cid, idx:0}; renderReports(); }));
  renderRepPreview();
}
function renderRepPreview(){
  const card = $('repPreviewCard'); if(!card) return;
  const month = monthById(repMonthId), cls = repSel && classById(repSel.classId);
  if(!cls || !month){ card.innerHTML = ''; return; }
  const items = classItems(cls, month.id); if(!items.length){ card.innerHTML = ''; return; }
  if(repSel.idx >= items.length) repSel.idx = 0;
  const r = items[repSel.idx];
  card.innerHTML = `<div class="card"><div class="pager">${iconBtn('left','Previous','data-pg="-1"')}<select id="repStu" dir="rtl">${items.map((x,i)=>`<option value="${i}" ${i===repSel.idx?'selected':''}>${esc(heName(x.s))}</option>`).join('')}</select><span>${repSel.idx+1} / ${items.length}</span>${iconBtn('right','Next','data-pg="1"')}
    <span style="width:16px;"></span>${iconBtn('print','Print this report','data-one="print"')}${iconBtn('download','Download this report','data-one="pdf"')}</div>
    <div style="max-width:720px;margin:0 auto;" id="repPv"></div></div>`;
  showPreview($('repPv'), reportPageHtml(r.cls, r.month, r.s, r.rec, lhOpt()));
  card.querySelectorAll('[data-pg]').forEach(b=> b.onclick = ()=>{ repSel.idx = (repSel.idx + Number(b.dataset.pg) + items.length) % items.length; renderRepPreview(); });
  card.querySelectorAll('[data-one]').forEach(b=> b.onclick = ()=>{ if(b.dataset.one==='print') printReports([r], lhOpt()); else downloadReports([r], lhOpt(), 'Report '+enName(r.s)+' '+month.label); });
  $('repStu').onchange = e=>{ repSel.idx = Number(e.target.value); renderRepPreview(); };
}
function openStudentReport(classId, sid){
  const months = sortedMonths().filter(m=>{ const r = recFor(classId, m.id); return r && hasAnyScore(r.perStudent[sid]); });
  if(months.length) repMonthId = months[months.length-1].id;
  const idx = Math.max(0, studentsOf(classId).findIndex(s=>s.id===sid));
  repSel = {classId, idx};
  activateTab('reports');
  setTimeout(()=>{ const c = $('repPreviewCard'); if(c) c.scrollIntoView({behavior:'smooth'}); }, 50);
}

/* ---------- Report Setup (Settings) ---------- */
const REPORT_TEXT_FIELDS = [['title','Title'],['signature','Signature'],['lead','Opening text · {month}','full'],['classLine','Class line · {class} {teacher}','full'],['note','Note','full'],['scoreNote','Score note','full'],['weekHeader','Weekly column'],['lateHeader','Late'],['absentHeader','Absent'],['earlyHeader','Left early']];
let setupPv = {classId:'', sid:'', monthId:''};
function renderReportSetup(box){
  const L = st.layout;
  box.innerHTML = `<div class="designer"><div>
    <details class="grp" ${st.reportPresets.length?'':''}><summary>Saved Designs</summary><div class="body">
      <div class="row nowrap"><select id="presetSel" style="flex:1;"><option value="">Choose a design</option>${options(st.reportPresets, p=>p.id, p=>p.name, '')}</select>${iconBtn('trash','Delete design','id="presetDel"','danger')}</div>
      <div class="row nowrap" style="margin-top:8px;"><input type="text" id="presetName" placeholder="Design name" style="flex:1;"><button class="btn" id="presetSave">Save</button></div></div></details>
    <details class="grp" open><summary>Letterhead &amp; Margins (mm)</summary><div class="body">
      <div class="sizes">${[['topMM','Top'],['bottomMM','Bottom'],['rightMM','Right'],['leftMM','Left']].map(([k,l])=>`<div class="field"><label>${l}</label><input type="number" min="0" max="140" data-margin="${k}" value="${L[k]}"></div>`).join('')}</div>
      <div class="row" style="margin-top:10px;"><label class="btn sec" for="lhFile" style="cursor:pointer;">Upload letterhead</label><input type="file" id="lhFile" accept="image/*" style="display:none;"><button class="btn sec" id="lhReset">Default letterhead</button></div></div></details>
    <details class="grp" open><summary>Text Sizes</summary><div class="body"><div class="sizes">${Object.keys(SIZE_LABELS).map(k=>`<div class="field"><label>${SIZE_LABELS[k]}</label><input type="number" min="8" max="60" data-size="${k}" value="${st.sizes[k]}"></div>`).join('')}</div></div></details>
    <details class="grp"><summary>Report Text</summary><div class="body"><div class="fields">${REPORT_TEXT_FIELDS.map(([k,l,full])=>`<div class="field ${full||''}"><label>${esc(l)}</label>${['lead','note'].includes(k)?`<textarea dir="rtl" data-rt="${k}">${esc(st.reportText[k]||'')}</textarea>`:`<input type="text" dir="rtl" data-rt="${k}" value="${esc(st.reportText[k]||'')}">`}</div>`).join('')}</div></div></details>
  </div><div>
    <div class="row" style="margin-bottom:8px;"><select id="spCls">${options(st.classes, c=>c.id, classLabel, setupPv.classId)}</select><select id="spStu" dir="rtl"></select><select id="spMonth" dir="rtl">${options(sortedMonths(), m=>m.id, m=>m.label, setupPv.monthId)}</select></div>
    <div class="preview-box"><div id="spPv" style="width:100%;"></div></div></div></div>`;
  const refreshStu = ()=>{ const list = studentsOf($('spCls').value); $('spStu').innerHTML = options(list, s=>s.id, s=>heName(s), setupPv.sid); setupPv.sid = $('spStu').value; };
  if(!setupPv.classId && st.classes[0]) $('spCls').value = st.classes[0].id;
  if(!setupPv.monthId){ const ms = sortedMonths().filter(m=>st.classes.some(c=>monthHasScores(c.id,m.id))); if(ms.length) $('spMonth').value = ms[ms.length-1].id; }
  setupPv.classId = $('spCls').value; setupPv.monthId = $('spMonth').value; refreshStu();
  const pv = ()=>{
    const cls = classById(setupPv.classId), m = monthById(setupPv.monthId), s = cls && studentsOf(cls.id).find(x=>x.id===setupPv.sid);
    if(!cls || !m || !s){ $('spPv').innerHTML = '<div class="empty">Add a student to see the preview</div>'; return; }
    showPreview($('spPv'), reportPageHtml(cls, m, s, recFor(cls.id, m.id), {letterhead:true}));
  };
  $('spCls').onchange = e=>{ setupPv.classId = e.target.value; setupPv.sid = ''; refreshStu(); pv(); };
  $('spStu').onchange = e=>{ setupPv.sid = e.target.value; pv(); };
  $('spMonth').onchange = e=>{ setupPv.monthId = e.target.value; pv(); };
  box.querySelectorAll('[data-margin]').forEach(i=> i.addEventListener('input', ()=>{ st.layout[i.dataset.margin] = Math.max(0, Number(i.value)||0); saveAll('Report margins'); pv(); }));
  box.querySelectorAll('[data-size]').forEach(i=> i.addEventListener('input', ()=>{ st.sizes[i.dataset.size] = Math.min(60, Math.max(8, Number(i.value)||12)); saveAll('Report text sizes'); pv(); }));
  box.querySelectorAll('[data-rt]').forEach(i=> i.addEventListener('input', ()=>{ st.reportText[i.dataset.rt] = i.value; saveAll('Report text'); pv(); }));
  $('lhFile').onchange = async e=>{
    const f = e.target.files[0]; if(!f) return;
    assets.letterheadDataUrl = await new Promise((res, rej)=>{ const r = new FileReader(); r.onload = ()=>res(r.result); r.onerror = rej; r.readAsDataURL(f); });
    currentLetterheadDataUrl = assets.letterheadDataUrl; persistAssets(); logEvent('Letterhead uploaded', f.name); e.target.value = ''; pv(); toast('Letterhead updated');
  };
  $('lhReset').onclick = ()=>{ assets.letterheadDataUrl = null; currentLetterheadDataUrl = DEFAULT_LETTERHEAD_DATAURL; persistAssets(); logEvent('Letterhead reset to default'); pv(); };
  $('presetSel').onchange = e=>{
    const p = st.reportPresets.find(x=>x.id===e.target.value); if(!p) return;
    st.layout = Object.assign({}, DEFAULT_LAYOUT, clone(p.layout||{})); st.sizes = Object.assign({}, DEFAULT_SIZES, clone(p.sizes||{})); st.reportText = Object.assign({}, DEFAULT_REPORT_TEXT, clone(p.reportText||{}));
    saveAll('Use saved design', p.name); renderReportSetup(box); $('presetSel').value = p.id; $('presetName').value = p.name;
  };
  $('presetSave').onclick = ()=>{
    const name = $('presetName').value.trim(); if(!name){ $('presetName').focus(); return; }
    const d = {layout:clone(st.layout), sizes:clone(st.sizes), reportText:clone(st.reportText)};
    let p = st.reportPresets.find(x=>x.name.toLowerCase()===name.toLowerCase());
    if(p) Object.assign(p, d); else { p = Object.assign({id:uid(), name}, d); st.reportPresets.push(p); }
    saveAll('Save design', name); toast('Design saved'); renderReportSetup(box);
  };
  $('presetDel').onclick = async ()=>{
    const p = st.reportPresets.find(x=>x.id===$('presetSel').value); if(!p) return;
    if(!await askConfirm('Delete design '+p.name+'?')) return;
    st.reportPresets = st.reportPresets.filter(x=>x.id!==p.id); saveAll('Delete design', p.name); doneWithUndo('Design deleted'); renderReportSetup(box);
  };
  pv();
}
