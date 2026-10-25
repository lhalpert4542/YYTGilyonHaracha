
/* =====================================================================
   Reports
   ===================================================================== */
const FONT_OPTIONS = [
  ["'David Libre', serif","David Libre"], ["'Frank Ruhl Libre', serif","Frank Ruhl Libre"], ["'Heebo', sans-serif","Heebo"],
  ["'Assistant', sans-serif","Assistant"], ["Georgia, serif","Georgia"], ["Arial, sans-serif","Arial"]
];
function allFontOptions(){ return FONT_OPTIONS.concat(st.customFonts.map(f=>[`'CF_${f.id}'`, f.label])); }
function applyTypography(){
  Object.keys(st.typography).forEach(k=>{
    document.documentElement.style.setProperty(`--r-${k}-font`, st.typography[k].font);
    document.documentElement.style.setProperty(`--r-${k}-size`, st.typography[k].size+'px');
  });
}
function applyLayout(){
  const L = st.layout;
  [['top','topMM'],['bottom','bottomMM'],['left','leftMM'],['right','rightMM']].forEach(([a,k])=> document.documentElement.style.setProperty(`--report-${a}-mm`, L[k]));
}
function fontFormat(ext){ ext = (ext||'').toLowerCase(); return {ttf:'truetype', otf:'opentype', woff:'woff', woff2:'woff2'}[ext] || 'truetype'; }
function fontFaceCss(){
  return st.customFonts.map(f=>{ const d = assets.customFontData[f.id]; return d ? `@font-face{font-family:'CF_${f.id}';src:url("${d}") format('${fontFormat(f.format)}');}` : ''; }).join('\n');
}
function injectFonts(){
  let el = $('customFontFaces');
  if(!el){ el = document.createElement('style'); el.id = 'customFontFaces'; document.head.appendChild(el); }
  el.textContent = fontFaceCss();
}

const rp = {idx:0};
function reportText(key, ctx){
  let t = String(st.reportText[key] ?? '');
  Object.entries(ctx||{}).forEach(([k,v])=>{ t = t.split('{'+k+'}').join(v ?? ''); });
  return t;
}
const rtHtml = (key, ctx)=> esc(reportText(key, ctx)).replace(/\n/g,'<br>');

function buildStudentReport(cls, month, s, rec){
  ensureClassShape(cls);
  const wc = rec ? rec.weekCount : 4;
  const d = ensureRecordShape(rec && rec.perStudent[s.id] ? clone(rec.perStudent[s.id]) : emptyStudentRecord(cls), cls);
  const par = rec ? rec.parshiot : [];
  const weekS = cls.subjects.filter(x=>x.kind==='week'), catS = cls.subjects.filter(x=>x.kind==='cat');
  const ctx = {month: month?month.label:'', student:s.name, class:cls.name, teacher:cls.teacher||''};
  let weekHtml = '';
  if(weekS.length){
    let rows = '';
    for(let i=0;i<wc;i++){
      const any = weekS.some(w=> (d.week[w.id]||[])[i]!=='' && (d.week[w.id]||[])[i]!==undefined);
      if(!par[i] && !any) continue;
      rows += `<tr><td>${esc(par[i]||('שבוע '+(i+1)))}</td>${weekS.map(w=>`<td>${esc((d.week[w.id]||[])[i]||'')}</td>`).join('')}</tr>`;
    }
    if(!rows) rows = `<tr><td colspan="${weekS.length+1}">—</td></tr>`;
    weekHtml = `<table class="rtab"><tr><th>${esc(st.reportText.weekHeader)}</th>${weekS.map(w=>`<th>${esc(w.label)}</th>`).join('')}</tr>${rows}</table><div class="catline">${rtHtml('scoreNote',ctx)}</div>`;
  }
  const catHtml = catS.length ? `<table class="rtab"><tr>${catS.map(c=>`<th>${esc(c.label)}</th>`).join('')}</tr><tr>${catS.map(c=>`<td>${esc(d.cat[c.id]||'')}</td>`).join('')}</tr></table>` : '';
  const bg = st.printLetterhead ? `background-image:url('${currentLetterheadDataUrl}');` : '';
  return `<div class="report-page" style="${bg}">
    <div class="bsd">בס"ד</div>
    <h2 class="title">${rtHtml('title',ctx)}</h2>
    <p class="lead">${rtHtml('lead',ctx)}</p>
    <div class="studentname">${esc(s.name)}</div>
    <div class="classline">${rtHtml('classLine',ctx)}</div>
    <div class="note">${rtHtml('note',ctx)}</div>
    ${weekHtml}${catHtml}
    <table class="rtab"><tr><th>${esc(st.reportText.lateHeader)}</th><th>${esc(st.reportText.absentHeader)}</th><th>${esc(st.reportText.earlyHeader)}</th></tr>
      <tr><td>${esc(d.ichurim||'')}</td><td>${esc(d.chesarim||'')}</td><td>${esc(d.yatza||'')}</td></tr></table>
    <div class="signline"><span>${rtHtml('signature',ctx)}</span> <span class="rule"></span></div>
  </div>`;
}

function reportList(){
  const scope = $('reportScope').value, monthId = $('reportMonthSelect').value;
  const month = st.months.find(m=>m.id===monthId);
  if(!month) return [];
  const out = [];
  const addClass = cls=> (st.students[cls.id]||[]).forEach(s=> out.push({cls, s, month, rec: recFor(cls.id, monthId)}));
  if(scope==='all') st.classes.forEach(addClass);
  else {
    const cls = st.classes.find(c=>c.id===$('reportClassSelect').value); if(!cls) return [];
    if(scope==='class') addClass(cls);
    else { const s = (st.students[cls.id]||[]).find(x=>x.id===$('reportStudentSelect').value); if(s) out.push({cls, s, month, rec: recFor(cls.id, monthId)}); }
  }
  return out;
}
function renderReports(){
  fillSelect($('reportClassSelect'), st.classes, c=>c.id, c=>c.name);
  const months = sortedMonths();
  const prevMonth = $('reportMonthSelect').value;
  fillSelect($('reportMonthSelect'), months, m=>m.id, m=>m.label);
  if(!prevMonth || !months.some(m=>m.id===prevMonth)){
    const has = test=> months.filter(m=> st.classes.some(c=>{ const r = recFor(c.id, m.id); return r && Object.values(r.perStudent).some(test); }));
    const full = has(d=> d && Object.values(d.cat||{}).some(v=>v!=='' && v!=null));
    const pickM = full.length ? full : has(hasAnyScore);
    if(pickM.length) $('reportMonthSelect').value = pickM[pickM.length-1].id;
  }
  refreshStudentSelect();
  toggleScopeUI();
  syncDesignInputs();
  renderPresetSelect();
  renderTypesetTable();
  renderCustomFontsList();
  renderPreview();
}
function refreshStudentSelect(){ fillSelect($('reportStudentSelect'), st.students[$('reportClassSelect').value]||[], s=>s.id, s=>s.name); }
function toggleScopeUI(){
  const scope = $('reportScope').value;
  $('reportClassSelect').style.display = scope==='all' ? 'none' : '';
  $('reportStudentSelect').style.display = scope==='student' ? '' : 'none';
}
['reportScope','reportClassSelect','reportStudentSelect','reportMonthSelect'].forEach(id=> $(id).addEventListener('change', ()=>{
  if(id==='reportClassSelect') refreshStudentSelect();
  toggleScopeUI(); rp.idx = 0; renderPreview();
}));

function renderPreview(){
  const list = reportList();
  if(rp.idx >= list.length) rp.idx = 0;
  $('printCount').textContent = list.length > 1 ? '('+list.length+')' : '';
  $('printReportsBtn').disabled = !list.length;
  const pager = $('previewPager');
  if(list.length > 1){
    const r = list[rp.idx];
    pager.innerHTML = `${iconBtn('left','Previous','data-pg="-1"')}<span><bdi>${esc(r.s.name)}</bdi> · ${rp.idx+1} / ${list.length}</span>${iconBtn('right','Next','data-pg="1"')}`;
  } else pager.innerHTML = '';
  const holder = $('typesetPreview');
  holder.innerHTML = list.length ? buildStudentReport(list[rp.idx].cls, list[rp.idx].month, list[rp.idx].s, list[rp.idx].rec) : '<div class="empty-state" style="align-self:center;">—</div>';
  scalePreview();
}
$('previewPager').addEventListener('click', e=>{
  const b = e.target.closest('[data-pg]'); if(!b) return;
  const n = reportList().length; rp.idx = (rp.idx + Number(b.dataset.pg) + n) % n; renderPreview();
});
function scalePreview(){
  const holder = $('typesetPreview'), page = holder.querySelector('.report-page');
  if(!page) return;
  page.style.transform = 'none';
  const h = page.offsetHeight, w = page.offsetWidth;
  const bh = holder.clientHeight - 14, bw = holder.clientWidth - 14;
  if(!h || !w || bh<=0) return;
  const sc = Math.min(bw/w, bh/h, 1);
  page.style.transformOrigin = 'top center';
  page.style.transform = `scale(${sc})`;
  page.style.marginBottom = `${-(h - h*sc)}px`;
}
window.addEventListener('resize', scalePreview);

function openStudentReport(classId, sid){
  activateTab('reports');
  $('reportScope').value = 'student';
  $('reportClassSelect').value = classId; refreshStudentSelect();
  $('reportStudentSelect').value = sid;
  const months = sortedMonths().filter(m=>{ const r = recFor(classId, m.id); return r && hasAnyScore(r.perStudent[sid]); });
  if(months.length) $('reportMonthSelect').value = months[months.length-1].id;
  toggleScopeUI(); rp.idx = 0; renderPreview();
}

$('printReportsBtn').addEventListener('click', ()=>{
  const list = reportList(); if(!list.length) return;
  const html = list.map(r=>buildStudentReport(r.cls, r.month, r.s, r.rec)).join('');
  const t = st.typography, L = st.layout;
  const vars = Object.keys(t).map(k=>`--r-${k}-font:${t[k].font}; --r-${k}-size:${t[k].size}px;`).join(' ') + ` --report-top-mm:${L.topMM}; --report-bottom-mm:${L.bottomMM}; --report-left-mm:${L.leftMM}; --report-right-mm:${L.rightMM};`;
  const css = Array.from(document.querySelectorAll('style')).map(s=>s.textContent).join('\n');
  const w = window.open('', '_blank');
  if(!w){ toast('Allow pop-ups to print'); return; }
  w.document.open();
  w.document.write(`<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>Reports</title>
<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700;900&family=David+Libre:wght@400;500;700&family=Heebo:wght@300;400;500;600;700&family=Assistant:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${css}
:root{${vars}}
body{background:#fff;}
.report-page{page-break-after:always; border:none; box-shadow:none;}
.report-page:last-child{page-break-after:auto;}
@page{margin:0; size:letter;}
</style></head><body>${html}<script>window.addEventListener('load',()=>{setTimeout(()=>{window.focus();window.print();},400);});<\/script></body></html>`);
  w.document.close();
});

/* ---- design settings ---- */
const REPORT_TEXT_FIELDS = {reportTextTitle:'title', reportTextLead:'lead', reportTextClassLine:'classLine', reportTextNote:'note', reportTextScoreNote:'scoreNote', reportTextSignature:'signature', reportTextWeekHeader:'weekHeader', reportTextLateHeader:'lateHeader', reportTextAbsentHeader:'absentHeader', reportTextEarlyHeader:'earlyHeader'};
const MARGINS = {topMarginInput:'topMM', bottomMarginInput:'bottomMM', leftMarginInput:'leftMM', rightMarginInput:'rightMM'};
function syncDesignInputs(){
  Object.entries(REPORT_TEXT_FIELDS).forEach(([id,k])=>{ const el = $(id); if(document.activeElement!==el) el.value = st.reportText[k]||''; });
  Object.entries(MARGINS).forEach(([id,k])=>{ const el = $(id); if(document.activeElement!==el) el.value = st.layout[k]; });
  $('printLetterheadSelect').value = st.printLetterhead ? 'with' : 'without';
}
Object.entries(REPORT_TEXT_FIELDS).forEach(([id,k])=> $(id).addEventListener('input', ()=>{ st.reportText[k] = $(id).value; saveAll('Report text'); renderPreview(); }));
Object.entries(MARGINS).forEach(([id,k])=> $(id).addEventListener('input', ()=>{ st.layout[k] = Math.max(0, Number($(id).value)||0); applyLayout(); saveAll('Report margins'); renderPreview(); }));
$('printLetterheadSelect').addEventListener('change', e=>{ st.printLetterhead = e.target.value==='with'; saveAll('Letterhead on reports', e.target.value); renderPreview(); });

function renderTypesetTable(){
  const opts = allFontOptions();
  $('typesetTable').innerHTML = Object.keys(st.typography).map(k=>{
    const t = st.typography[k];
    return `<div class="typeset-row"><div class="trlabel">${esc(TYPE_LABELS[k]||k)}</div><div class="trcontrols">
      <select data-role="${k}" class="tf-font">${opts.map(([v,l])=>`<option value="${esc(v)}" ${v===t.font?'selected':''}>${esc(l)}</option>`).join('')}</select>
      <input type="number" data-role="${k}" class="tf-size" min="8" max="60" value="${t.size}"></div></div>`;
  }).join('');
  $('typesetTable').querySelectorAll('.tf-font').forEach(sel=> sel.addEventListener('change', ()=>{ st.typography[sel.dataset.role].font = sel.value; applyTypography(); saveAll('Report fonts'); renderPreview(); }));
  $('typesetTable').querySelectorAll('.tf-size').forEach(inp=> inp.addEventListener('input', ()=>{ st.typography[inp.dataset.role].size = Number(inp.value)||12; applyTypography(); saveAll('Report fonts'); renderPreview(); }));
}

function fileToDataURL(file){ return new Promise((res, rej)=>{ const r = new FileReader(); r.onload = ()=>res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
$('letterheadFileInput').addEventListener('change', async e=>{
  const f = e.target.files[0]; if(!f) return;
  assets.letterheadDataUrl = await fileToDataURL(f);
  currentLetterheadDataUrl = assets.letterheadDataUrl;
  persistAssets(); logEvent('Letterhead uploaded', f.name);
  e.target.value = ''; renderPreview(); toast('Letterhead updated');
});
$('resetLetterheadBtn').addEventListener('click', ()=>{
  assets.letterheadDataUrl = null; currentLetterheadDataUrl = DEFAULT_LETTERHEAD_DATAURL;
  persistAssets(); logEvent('Letterhead reset to default'); renderPreview();
});

function renderCustomFontsList(){
  $('addFontBtn').innerHTML = ICON.plus;
  $('customFontsList').innerHTML = st.customFonts.map(f=>`<div class="row-flex nowrap" style="justify-content:space-between;"><span style="font-family:'CF_${esc(f.id)}';">${esc(f.label)}</span>${iconBtn('trash','Remove font',`data-font="${esc(f.id)}"`,'danger')}</div>`).join('');
  $('customFontsList').querySelectorAll('[data-font]').forEach(b=> b.addEventListener('click', ()=>{
    const f = st.customFonts.find(x=>x.id===b.dataset.font);
    st.customFonts = st.customFonts.filter(x=>x.id!==b.dataset.font);
    saveAll('Remove font', f ? f.label : ''); doneWithUndo('Font removed');
    renderTypesetTable(); renderCustomFontsList();
  }));
}
$('addFontBtn').addEventListener('click', async ()=>{
  const file = $('fontFileInput').files[0]; if(!file){ $('fontFileInput').click(); return; }
  const label = $('fontNameInput').value.trim() || file.name.replace(/\.[^.]+$/,'');
  const id = uid();
  assets.customFontData[id] = await fileToDataURL(file);
  st.customFonts.push({id, label, format: file.name.split('.').pop()});
  persistAssets(); injectFonts();
  $('fontFileInput').value = ''; $('fontNameInput').value = '';
  saveAll('Add font', label);
  renderTypesetTable(); renderCustomFontsList();
});

function renderPresetSelect(){
  const sel = $('reportPresetSelect'), keep = sel.value;
  sel.innerHTML = '<option value="">Saved designs</option>' + st.reportPresets.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  if(st.reportPresets.some(p=>p.id===keep)) sel.value = keep;
  sel.style.display = st.reportPresets.length ? '' : 'none';
  $('deleteReportPresetBtn').innerHTML = ICON.trash;
}
$('reportPresetSelect').addEventListener('change', e=>{
  const p = st.reportPresets.find(x=>x.id===e.target.value); if(!p) return;
  if(p.typography) st.typography = clone(p.typography);
  st.layout = Object.assign({topMM:68,bottomMM:50,leftMM:25,rightMM:25}, clone(p.layout||{}));
  st.reportText = Object.assign({}, DEFAULT_REPORT_TEXT, clone(p.reportText||{}));
  st.printLetterhead = !!p.printLetterhead;
  $('reportPresetName').value = p.name;
  applyTypography(); applyLayout();
  saveAll('Use saved design', p.name);
  syncDesignInputs(); renderTypesetTable(); renderPreview();
});
$('saveReportPresetBtn').addEventListener('click', ()=>{
  const name = $('reportPresetName').value.trim(); if(!name){ $('reportPresetName').focus(); return; }
  const snapD = {typography:clone(st.typography), layout:clone(st.layout), reportText:clone(st.reportText), printLetterhead:st.printLetterhead};
  let p = st.reportPresets.find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(p) Object.assign(p, snapD); else { p = Object.assign({id:uid(), name}, snapD); st.reportPresets.push(p); }
  saveAll('Save design', name); renderPresetSelect(); $('reportPresetSelect').value = p.id; toast('Design saved');
});
$('deleteReportPresetBtn').addEventListener('click', async ()=>{
  const p = st.reportPresets.find(x=>x.id===$('reportPresetSelect').value); if(!p) return;
  if(!await askConfirm('Delete design '+p.name+'?')) return;
  st.reportPresets = st.reportPresets.filter(x=>x.id!==p.id);
  $('reportPresetName').value = '';
  saveAll('Delete design', p.name); doneWithUndo('Design deleted'); renderPresetSelect();
});
