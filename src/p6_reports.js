
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
// on reports, a weekly score under the limit in Settings prints as text instead of the number
const failLimit = cls => { const own = cls && cls.failBelow; return (own!=='' && own!=null && !isNaN(Number(own))) ? Number(own) : ''; };
function reportScore(raw, cls){
  const v = String(raw ?? '').trim();
  if(v==='' || isNaN(Number(v))) return esc(v);
  const lim = failLimit(cls);
  return (lim!=='' && lim!=null && !isNaN(Number(lim)) && Number(v) < Number(lim)) ? `<span class="fail">${esc(st.reportText.failText||'לא הצליח')}</span>` : esc(v);
}
function reportPageHtml(cls, month, s, rec, opt){
  opt = opt || {};
  ensureClassShape(cls);
  const wc = rec ? rec.weekCount : 4;
  const d = ensureRecordShape(rec && rec.perStudent[s.id] ? clone(rec.perStudent[s.id]) : emptyStudentRecord(cls), cls);
  const par = parshiotFor(cls.id, month ? month.id : ''), typed = rec ? rec.parshiot : [];
  const weekS = cls.subjects.filter(x=>x.kind==='week'), catS = cls.subjects.filter(x=>x.kind==='cat');
  const ctx = {month: month ? month.label : '', student: heName(s), class: heName(cls), teacher: heName(teacherOf(cls))};
  let weekHtml = '';
  if(weekS.length){
    let rows = '';
    // a week is on the report once the class has weekly scores for it; a blank score shows חסר
    const filled = v => String(v ?? '').trim()!=='';
    const classWeek = i => rec && Object.values(rec.perStudent||{}).some(x=> weekS.some(w=> filled(((x.week||{})[w.id]||[])[i])));
    const miss = `<span class="miss">${esc(st.reportText.missingText||'חסר')}</span>`;
    for(let i=0;i<wc;i++){
      if(!classWeek(i) && !String(typed[i]||'').trim()) continue;
      rows += `<tr><td>${esc(par[i]||('שבוע '+(i+1)))}</td>${weekS.map(w=>{ const v = (d.week[w.id]||[])[i]; return `<td>${filled(v) ? reportScore(v, cls) : miss}</td>`; }).join('')}</tr>`;
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
function reportDocs(items, opt, folders){ return items.map(r=>({name: lastKey(r.s), label: heName(r.s), folder: folders ? 'כתה '+heName(r.cls) : '', html: reportPageHtml(r.cls, r.month, r.s, r.rec, opt)})); }
function downloadReports(items, opt, name, folders){ if(items.length) askPdf(reportDocs(items, opt, folders), {name, title:'Making report PDF', unit:'reports', extra:'sorted by last name', selector:'.report-page'}); }
/* review sheets: the assessment filled with the saved scores, for teachers to check */
function printReview(classes, monthId){ const h = classes.map(c=>reviewSheetHtml(c, monthId)).join(''); if(h) printHtml('Review', SHEET_PRINT_HEAD, h); }
function downloadReview(classes, monthId, name){
  const m = monthById(monthId);
  const docs = classes.map(c=>({name:'לבדיקה '+heName(c)+' '+(m?m.label:''), label: heName(c), html: reviewSheetHtml(c, monthId)}));
  if(docs.length) askPdf(docs, {name, title:'Making review PDF', unit:'classes', css:SHEET_CSS, landscape:true, selector:'.sheet'});
}

/* ---------- view in the app: one page at a time ---------- */
// pages: [{label, html}], opt: {landscape, onPrint, onPdf}
function openViewer(title, pages, opt){
  if(!pages.length) return;
  opt = opt || {}; let i = 0;
  const draw = box=>{
    const p = pages[i];
    box.querySelector('#vwCount').textContent = (i+1)+' / '+pages.length;
    box.querySelector('#vwSel').value = String(i);
    const area = box.querySelector('#vwArea');
    if(opt.landscape){
      area.innerHTML = `<style>${SHEET_CSS}</style><div class="vw-land">${p.html}</div>`;
      const wrap = area.querySelector('.vw-land'), sh = wrap.querySelector('.sheet'), sc = Math.min(1, (area.clientWidth-4)/1056);
      wrap.style.cssText = `width:${1056*sc}px;height:${816*sc}px;margin:0 auto;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.15);`;
      sh.style.transform = `scale(${sc})`; sh.style.transformOrigin = 'top left';
    } else showPreview(area, p.html);
  };
  openModal(`<div class="card-head"><h2 style="margin:0;">${esc(title)}</h2><span class="sp"></span>
      ${iconBtn('left','Previous','data-pg="-1"')}<select id="vwSel" dir="rtl" style="max-width:220px;">${pages.map((p,k)=>`<option value="${k}">${esc(p.label)}</option>`).join('')}</select><span id="vwCount" class="small muted"></span>${iconBtn('right','Next','data-pg="1"')}
      <span style="width:10px;"></span>${opt.onPrint?`<button class="btn sec sm" data-a="print">${ICON.print}Print</button>`:''}${opt.onPdf?`<button class="btn sec sm" data-a="pdf">${ICON.download}PDF</button>`:''}<button class="btn sm" data-a="close">Close</button></div>
    <div id="vwArea" style="background:#e9eeee;padding:10px;border-radius:8px;max-height:78vh;overflow:auto;${opt.landscape?'':'max-width:760px;margin:0 auto;'}"></div>`, box=>{
    box.querySelectorAll('[data-pg]').forEach(b=> b.onclick = ()=>{ i = (i + Number(b.dataset.pg) + pages.length) % pages.length; draw(box); });
    box.querySelector('#vwSel').onchange = e=>{ i = Number(e.target.value); draw(box); };
    box.querySelector('[data-a=close]').onclick = closeModal;
    if(opt.onPrint) box.querySelector('[data-a=print]').onclick = opt.onPrint;
    if(opt.onPdf) box.querySelector('[data-a=pdf]').onclick = ()=>{ closeModal(); opt.onPdf(); };
    draw(box);
  }, true);
}
function viewReports(items, title, pdfName, folders){
  openViewer(title, items.map(r=>({label: heName(r.s), html: reportPageHtml(r.cls, r.month, r.s, r.rec, lhOpt())})),
    {onPrint: ()=>printReports(items, lhOpt()), onPdf: ()=>downloadReports(items, lhOpt(), pdfName, folders)});
}
function viewReview(classes, monthId, title, pdfName){
  openViewer(title, classes.map(c=>({label: heName(c), html: reviewSheetHtml(c, monthId)})),
    {landscape:true, onPrint: ()=>printReview(classes, monthId), onPdf: ()=>downloadReview(classes, monthId, pdfName)});
}

/* ---------- page: a box per month, like Assessments ---------- */
let repMonthId = '', repSel = null;   // {classId, idx}
function classItems(cls, monthId){ const m = monthById(monthId), rec = recFor(cls.id, monthId); return sortedStudents(cls.id).map(s=>({cls, month:m, s, rec})); }
const repClasses = () => st.classes.filter(c=>studentsOf(c.id).length);
const scoredClasses = monthId => repClasses().filter(c=>monthHasScores(c.id, monthId));
function monthItems(monthId){ const out = []; scoredClasses(monthId).forEach(c=> out.push(...classItems(c, monthId))); return out; }
const lhOpt = () => ({letterhead: st.printLetterhead});
const seg = (label, html) => `<span class="seg"><small>${label}</small>${html}</span>`;
function renderReports(){
  const P = $('panel-reports'), months = sortedMonths(), classes = repClasses();
  if(!months.some(m=>m.id===repMonthId)){
    const withData = months.filter(m=> scoredClasses(m.id).length);
    repMonthId = (withData[withData.length-1] || months[0] || {}).id || '';
  }
  if(repSel && (!classById(repSel.classId))) repSel = null;
  const cards = months.map(m=>{
    const sc = scoredClasses(m.id).length, dis = sc ? '' : 'disabled';
    const b = (act, icon, tip) => `<button type="button" class="icon-btn" data-mact="${act}" data-tip="${tip}" ${dis}>${ICON[icon]}</button>`;
    return `<div class="mcard ${m.id===repMonthId?'sel':''}" data-m="${m.id}"><div class="m">${esc(m.label)}</div><div class="s">${sc ? `${sc}/${classes.length} classes with scores` : 'No scores yet'}</div>
      <div class="acts">${seg('Review', b('rview','view','View review sheets')+b('rprint','print','Print review sheets')+b('rpdf','download','Review sheets PDF'))}${seg('Reports', b('view','view','View reports')+b('print','print','Print reports')+b('pdf','download','Reports PDF'))}</div></div>`;
  }).join('');
  const month = monthById(repMonthId);
  const table = month ? `<div class="card"><div class="card-head"><h2 class="he">${esc(month.label)}</h2></div>${classes.length ? `<table class="t"><thead><tr><th>Class</th><th>Teacher</th><th>Students with scores</th><th></th></tr></thead><tbody>${classes.map(c=>{
      const n = studentsOf(c.id).length, rec = recFor(c.id, month.id), filled = rec ? studentsOf(c.id).filter(s=>hasAnyScore(rec.perStudent[s.id])).length : 0, dis = filled ? '' : 'disabled';
      const b = (act, icon, tip) => `<button type="button" class="icon-btn" data-ract="${act}" data-tip="${tip}" ${dis}>${ICON[icon]}</button>`;
      return `<tr data-cid="${esc(c.id)}" class="click ${repSel&&repSel.classId===c.id?'sel':''}"><td>${he(heName(c))}</td><td>${he(heName(teacherOf(c)))}</td>
        <td><span class="${filled===n?'':'muted'}">${filled}/${n}</span></td>
        <td class="act">${seg('Review', b('rview','view','View review sheet')+b('rprint','print','Print review sheet')+b('rpdf','download','Review sheet PDF'))}${seg('Reports', b('view','view','View reports')+b('print','print','Print reports')+b('pdf','download','Reports PDF'))}</td></tr>`;
    }).join('')}</tbody></table>` : '<div class="empty">No classes with students</div>'}</div>` : '';
  P.innerHTML = pageHead('Reports', `<select id="repLh"><option value="with">With letterhead</option><option value="without">Without letterhead</option></select>`) +
    `<div class="month-cards wide">${cards}</div>${table}<div id="repPreviewCard"></div>`;
  $('repLh').value = st.printLetterhead ? 'with' : 'without';
  $('repLh').addEventListener('change', e=>{ st.printLetterhead = e.target.value==='with'; saveAll('Letterhead on reports', e.target.value); renderRepPreview(); });
  P.querySelectorAll('.mcard').forEach(card=> card.addEventListener('click', e=>{ if(e.target.closest('button')) return; repMonthId = card.dataset.m; repSel = null; renderReports(); }));
  P.querySelectorAll('[data-mact]').forEach(b=> b.addEventListener('click', e=>{
    e.stopPropagation();
    const m = monthById(b.closest('.mcard').dataset.m), a = b.dataset.mact, cls = scoredClasses(m.id);
    if(a==='rview') viewReview(cls, m.id, 'Review sheets '+m.label, 'Review sheets '+m.label);
    else if(a==='view') viewReports(monthItems(m.id), 'Reports '+m.label, 'Reports '+m.label, true);
    else if(a==='rprint') printReview(cls, m.id);
    else if(a==='rpdf') downloadReview(cls, m.id, 'Review sheets '+m.label);
    else if(a==='print') printReports(monthItems(m.id), lhOpt());
    else if(a==='pdf') downloadReports(monthItems(m.id), lhOpt(), 'Reports '+m.label, true);
  }));
  P.querySelectorAll('[data-ract]').forEach(b=> b.addEventListener('click', e=>{
    e.stopPropagation();
    const cls = classById(b.closest('tr').dataset.cid), a = b.dataset.ract;
    if(a==='preview'){ repSel = {classId: cls.id, idx:0}; renderReports(); setTimeout(()=>$('repPreviewCard').scrollIntoView({behavior:'smooth'}), 30); }
    else if(a==='rview') viewReview([cls], month.id, 'Review '+enName(cls)+' '+month.label, 'לבדיקה '+heName(cls)+' '+month.label);
    else if(a==='view') viewReports(classItems(cls, month.id), 'Reports '+enName(cls)+' '+month.label, 'Reports '+enName(cls)+' '+month.label);
    else if(a==='rprint') printReview([cls], month.id);
    else if(a==='rpdf') downloadReview([cls], month.id, 'לבדיקה '+heName(cls)+' '+month.label);
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
  card.querySelectorAll('[data-one]').forEach(b=> b.onclick = ()=>{ if(b.dataset.one==='print') printReports([r], lhOpt()); else downloadReports([r], lhOpt(), lastKey(r.s)+' '+month.label); });
  $('repStu').onchange = e=>{ repSel.idx = Number(e.target.value); renderRepPreview(); };
}

/* ---------- Report Setup (Settings) ---------- */
const REPORT_TEXT_FIELDS = [['title','Title'],['signature','Signature'],['lead','Opening text · {month}','full'],['classLine','Class line · {class} {teacher}','full'],['note','Note','full'],['scoreNote','Score note','full'],['weekHeader','Weekly column'],['lateHeader','Late'],['absentHeader','Absent'],['earlyHeader','Left early'],['failText','Weekly score below the limit'],['missingText','Weekly score left blank']];
let setupPv = {classId:'', sid:'', monthId:''};
function renderReportSetup(box){
  const L = st.layout;
  box.innerHTML = `<div class="designer"><div>
    <details class="grp" ${st.reportPresets.length?'':''}><summary>Saved Designs</summary><div class="body">
      <div class="row nowrap"><select id="presetSel" style="flex:1;"><option value="">Choose a design</option>${options(st.reportPresets, p=>p.id, p=>p.name, '')}</select>${iconBtn('trash','Delete design','id="presetDel"','danger')}</div>
      <div class="row nowrap" style="margin-top:8px;"><input type="text" id="presetName" placeholder="Design name" style="flex:1;"><button class="btn" id="presetSave">Save</button></div></div></details>
    <details class="grp" open><summary>Letterhead &amp; Margins (mm)</summary><div class="body">
      <div class="sizes">${[['topMM','Top'],['bottomMM','Bottom'],['rightMM','Right'],['leftMM','Left']].map(([k,l])=>`<div class="field"><label>${l}</label><input type="number" min="0" max="140" data-margin="${k}" value="${L[k]}"></div>`).join('')}</div>
      <div class="row" style="margin-top:10px;"><label class="btn sec" for="lhFile" style="cursor:pointer;">Upload letterhead</label><input type="file" id="lhFile" accept="image/*,.pdf" style="display:none;"><button class="btn sec" id="lhReset">Default letterhead</button></div></div></details>
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
    const f = e.target.files[0]; e.target.value = ''; if(!f) return;
    let url, w = 0;
    try{
      if(/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)){
        // PDF: first page at 300 dpi (2550 × 3300 for letter size)
        toast('Reading the PDF…');
        await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', 'pdfjsLib');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        const pdf = await window.pdfjsLib.getDocument({data: new Uint8Array(await f.arrayBuffer())}).promise;
        const page = await pdf.getPage(1), v1 = page.getViewport({scale:1}), v = page.getViewport({scale: 2550 / v1.width});
        const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,c.width,c.height);
        await page.render({canvasContext:ctx, viewport:v}).promise;
        url = c.toDataURL('image/jpeg', .9); w = c.width;
      } else {
        url = await new Promise((res, rej)=>{ const r = new FileReader(); r.onload = ()=>res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        w = await new Promise(res=>{ const i = new Image(); i.onload = ()=>res(i.naturalWidth); i.onerror = ()=>res(0); i.src = url; });
      }
    }catch(err){ toast('Could not read that file'); return; }
    assets.letterheadDataUrl = url; currentLetterheadDataUrl = url;
    persistAssets(); logEvent('Letterhead uploaded', f.name); pv();
    if(w && w < 1700) openModal(`<h2>Low-resolution letterhead</h2><p>This image is only ${w} pixels wide, so it will print blurry. For sharp printing use a PDF of the letterhead, or an image at least 2550 × 3300 pixels.</p><div class="actions"><button class="btn" data-a="ok">OK</button></div>`, b=>{ b.querySelector('[data-a=ok]').onclick = closeModal; });
    else toast('Letterhead updated');
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
