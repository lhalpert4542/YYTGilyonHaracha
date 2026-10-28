
/* =====================================================================
   Printing & PDF (shared)
   Print opens the browser's print dialog. PDF downloads a file.
   ===================================================================== */
const LIB_H2I = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js';
const LIB_PDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
ICON.download = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
ICON.review = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>';
ICON.gen = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/></svg>';
let printFrame = null;
function printHtml(title, headHtml, bodyHtml, extraScript){
  if(printFrame) printFrame.remove();
  const f = printFrame = document.createElement('iframe');
  f.setAttribute('aria-hidden','true');
  f.style.cssText = 'position:fixed;left:-20000px;top:0;width:11in;height:11in;border:0;';
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open();
  d.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>*,*::before,*::after{-webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; color-adjust:exact !important;}</style>${headHtml}</head><body>${bodyHtml}<script>${extraScript||''}<\/script></body></html>`);
  d.close();
  const go = ()=>{
    const w = f.contentWindow;
    (w.document.fonts ? w.document.fonts.ready : Promise.resolve()).then(()=>{
      if(w.__fit) w.__fit();
      setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){ toast('Could not open the print dialog'); } }, 250);
    });
  };
  if(f.contentDocument.readyState==='complete') setTimeout(go, 150); else f.onload = go;
}
const LIB_ZIP = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
const safeFile = n => String(n||'file').replace(/[\\\/:*?"<>|]/g,'-').replace(/\s+/g,' ').trim();
let pdfJob = null;
function showProgress(title){
  openModal(`<h2>${esc(title)}</h2><div class="progress" style="height:10px;"><div id="pdfBar" style="width:0%"></div></div>
    <div id="pdfMsg" class="small muted" style="margin-top:8px;">Starting…</div>
    <div class="actions"><button class="btn sec" id="pdfCancel">Cancel</button></div>`, box=>{
    $('pdfCancel').onclick = ()=>{ if(pdfJob) pdfJob.cancel = true; $('pdfMsg').textContent = 'Cancelling…'; };
  });
}
function setProgress(done, total, msg){ const b = $('pdfBar'), m = $('pdfMsg'); if(b) b.style.width = Math.round(done/Math.max(1,total)*100)+'%'; if(m) m.textContent = msg; }
function saveBlob(blob, name){ const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 4000); }
/* docs: [{name, html}] – one PDF each. combined:true → one PDF with every page. */
async function makePdfs(docs, opt){
  opt = opt || {};
  if(!docs.length) return;
  if(pdfJob){ toast('A PDF is already being made'); return; }
  const job = pdfJob = {cancel:false};
  showProgress(opt.title || 'Making PDF');
  try{
    await loadScript(LIB_H2I, 'htmlToImage'); await loadScript(LIB_PDF, 'jspdf');
    if(!opt.combined && docs.length>1) await loadScript(LIB_ZIP, 'JSZip');
  }catch(e){ closeModal(); pdfJob = null; toast('Could not load the PDF tool. Check the internet connection.'); return; }
  const land = !!opt.landscape, W = land ? 11 : 8.5, Hh = land ? 8.5 : 11, fontCss = ($('reportFontFace')||{}).textContent || '';
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-30000px;top:0;z-index:-1;';
  document.body.appendChild(host);
  const total = docs.reduce((n,d)=> n + (d.pages || 1), 0);
  let done = 0;
  const newPdf = ()=> new window.jspdf.jsPDF({orientation: land ? 'landscape' : 'portrait', unit:'in', format:'letter', compress:true});
  const zip = (!opt.combined && docs.length>1) ? new window.JSZip() : null;
  let pdf = opt.combined ? newPdf() : null, first = true;
  try{
    for(const d of docs){
      if(job.cancel) break;
      host.innerHTML = (opt.css ? `<style>${opt.css}</style>` : '') + d.html;
      await Promise.all(Array.from(host.querySelectorAll('img')).map(i=> i.decode ? i.decode().catch(()=>{}) : null));
      if(document.fonts) await document.fonts.ready;
      fitReports(host);
      if(!opt.combined){ pdf = newPdf(); first = true; }
      for(const pg of Array.from(host.querySelectorAll(opt.selector || '.report-page, .sheet'))){
        if(job.cancel) break;
        setProgress(done, total, `${d.label || d.name} · ${done+1} of ${total}`);
        const url = await window.htmlToImage.toJpeg(pg, {quality:.95, pixelRatio:3, backgroundColor:'#ffffff', fontEmbedCSS: fontCss, cacheBust:false});
        if(!first) pdf.addPage('letter', land ? 'landscape' : 'portrait');
        pdf.addImage(url, 'JPEG', 0, 0, W, Hh, undefined, 'FAST'); first = false;
        done++;
      }
      if(job.cancel) break;
      if(!opt.combined){ if(zip) zip.file((d.folder ? safeFile(d.folder)+'/' : '')+safeFile(d.name)+'.pdf', pdf.output('blob')); else pdf.save(safeFile(d.name)+'.pdf'); }
    }
    if(job.cancel){ toast('Cancelled'); return; }
    setProgress(total, total, 'Saving…');
    if(opt.combined) pdf.save(safeFile(opt.name)+'.pdf');
    else if(zip) saveBlob(await zip.generateAsync({type:'blob'}), safeFile(opt.name)+'.zip');
    toast('Downloaded');
  }catch(e){ console.error(e); toast('Could not make the PDF'); }
  finally{ host.remove(); pdfJob = null; closeModal(); }
}
// asks combined or one file each, then makes the PDFs
function askPdf(docs, opt){
  if(docs.length<=1) return makePdfs(docs, Object.assign({combined:true, name: docs[0] && docs[0].name}, opt));
  openModal(`<h2>Download PDF</h2><p class="small muted" style="margin-bottom:12px;">${docs.length} ${esc(opt.unit||'files')}${opt.extra?' · '+esc(opt.extra):''}</p>
    <div class="fl"><label style="display:flex;gap:8px;align-items:center;font-size:14px;color:var(--ink);"><input type="radio" name="pdfKind" value="one" checked> One combined PDF</label>
    <label style="display:flex;gap:8px;align-items:center;font-size:14px;color:var(--ink);"><input type="radio" name="pdfKind" value="each"> A separate PDF for each (in a ZIP)</label></div>
    <div class="actions"><button class="btn sec" data-a="no">Cancel</button><button class="btn" data-a="yes">${ICON.download}Download</button></div>`, box=>{
    box.querySelector('[data-a=no]').onclick = closeModal;
    box.querySelector('[data-a=yes]').onclick = ()=>{ const each = box.querySelector('[name=pdfKind]:checked').value==='each'; closeModal(); makePdfs(docs, Object.assign({}, opt, {combined:!each})); };
  });
}

/* =====================================================================
   Assessments – one branded sheet per class, scanned back with Claude
   ===================================================================== */
const ROWS_PER_PAGE = 999;   // one page per class
const CREDITS_MSG = 'Scanning credits are used. Contact your admin to top up.';
let assessMonthId = '';
let scan = null;   // {pages:[], sel, busy}

function sheetLayout(cls, monthId){
  ensureClassShape(cls);
  const rec = recFor(cls.id, monthId), wc = rec ? rec.weekCount : 4;
  return {
    rows: sortedStudents(cls.id).map(s=>({sid:s.id, nameHe: heName(s)})),
    cols: buildColumnDefs(cls, wc).map(d=>({type:d.type, id:d.id, week:d.week, he:d.he})),
    weekCount: wc,
    classHe: heName(cls), teacherHe: heName(teacherOf(cls))
  };
}
const layoutSig = l => hashStr(JSON.stringify(l));
function newCode(){ const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c; do{ c = 'GH-'; for(let i=0;i<5;i++) c += A[Math.floor(Math.random()*A.length)]; }while(Object.values(st.sheets).some(s=>s.code===c)); return c; }
function sheetState(cls, monthId){
  const sh = st.sheets[gradeKey(cls.id, monthId)];
  if(!sh) return 'none';
  if(sh.sig !== layoutSig(sheetLayout(cls, monthId))) return 'stale';
  return sh.scannedAt ? 'scanned' : 'generated';
}
const STATE_TAG = {none:'<span class="tag">Not generated</span>', generated:'<span class="tag wait">Generated</span>', stale:'<span class="tag warn">Changed since generated</span>', scanned:'<span class="tag ok">Scanned</span>'};
const sheetClasses = () => st.classes.filter(c=>studentsOf(c.id).length);
function generateSheet(cls, monthId){
  const layout = sheetLayout(cls, monthId);
  st.sheets[gradeKey(cls.id, monthId)] = {code:newCode(), at:Date.now(), layout, sig:layoutSig(layout), scannedAt:null};
}
function findSheetByCode(raw){
  const m = String(raw||'').toUpperCase().replace(/\s+/g,'').match(/GH-?([A-Z0-9]{5})(?:-?P(\d+))?/);
  if(!m) return null;
  const code = 'GH-'+m[1];
  const key = Object.keys(st.sheets).find(k=>st.sheets[k].code===code);
  return key ? {key, page:1} : null;
}

/* ---------- the printed sheet ---------- */
function qrImg(text){
  try{ if(!window.qrcode) return ''; const q = qrcode(0,'M'); q.addData(text); q.make(); return `<img class="qr" src="${q.createDataURL(4,0)}" alt="">`; }catch(e){ return ''; }
}
const SHEET_CSS = `
.sheet{width:11in; height:8.5in; position:relative; padding:.38in .45in .32in; box-sizing:border-box; direction:rtl; overflow:hidden; background:#fff; color:#123038; font-family:Arial,'Heebo',sans-serif;}
.sheet .corner{position:absolute; width:0; height:0; border:.085in solid #000; box-sizing:content-box;}
.sheet .corner.tl{top:.2in; left:.2in;} .sheet .corner.tr{top:.2in; right:.2in;} .sheet .corner.bl{bottom:.2in; left:.2in;} .sheet .corner.br{bottom:.2in; right:.2in;}
.sheet .sh-head{display:flex; align-items:center; gap:.18in; padding-bottom:.08in; border-bottom:3px solid #d5aa4e; margin-bottom:.12in; height:1in;}
.sheet .sh-logo{height:.82in; width:auto; background:#0b4856; border-radius:8px; padding:4px 8px;}
.sheet .sh-titles{flex:1;}
.sheet .sh-title{font-size:25px; font-weight:700; color:#0b4856; line-height:1.1;}
.sheet .sh-sub{font-size:16px; margin-top:4px; color:#123038;}
.sheet .sh-sub b{color:#0b4856;}
.sheet .sh-code{text-align:center; font-family:'Courier New',monospace; font-size:11px; letter-spacing:1px; direction:ltr; color:#123038;}
.sheet .sh-code .qr{width:.78in; height:.78in; image-rendering:pixelated; display:block; margin:0 auto 2px;}
.sheet table.sh{width:100%; border-collapse:collapse; table-layout:fixed;}
.sheet table.sh th, .sheet table.sh td{border:1.2px solid #24434a; text-align:center; padding:1px 2px;}
.sheet table.sh thead tr.g th{background:#0b4856; color:#fff; font-size:12px; font-weight:700; height:.3in;}
.sheet table.sh thead tr.s th{background:#e6f0f1; color:#0b4856; font-size:11px; font-weight:700; overflow-wrap:anywhere; line-height:1.1; height:.32in;}
.sheet table.sh th.wk .p{display:block; font-weight:400; font-size:10px; margin-top:2px; color:#d9e8e8; text-align:center; padding:0 2px;}
.sheet table.sh th.wk .p span{display:inline-block; width:62%; border-bottom:1px solid #d5aa4e; height:12px;}
.sheet table.sh td.nm{text-align:right; padding-right:6px; white-space:nowrap; overflow:hidden; font-weight:600;}
.sheet table.sh td.no{color:#5a7479; font-size:11px;}
.sheet table.sh tbody tr:nth-child(even) td.nm, .sheet table.sh tbody tr:nth-child(even) td.no{background:#f6f9f9;}
.sheet table.sh .gs{border-right:3px solid #0b4856 !important;}
.sheet table.sh thead tr.g th.gs{border-right-color:#d5aa4e !important;}
.sheet table.sh td.val{font-size:15px; font-weight:700; color:#0b4856;}
.sheet .pf{color:#fff; font-size:12px;}
.sheet .sh-review{border:2px solid #d5aa4e; color:#0b4856; font-weight:700; padding:8px 14px; border-radius:6px; font-size:15px;}
.sheet .sh-foot{position:absolute; bottom:.3in; left:.45in; right:.45in; font-size:10.5px; color:#5a7479; display:flex; justify-content:space-between;}
`;
const SHEET_PRINT_HEAD = `<style>${SHEET_CSS} @page{size:letter landscape; margin:0;} body{margin:0;} .sheet{page-break-after:always;} .sheet:last-child{page-break-after:auto;}</style>`;
const colGroup = c => c.type==='cat' ? 'cat' : c.type==='week' ? 'w'+c.week : 'att';
const groupStarts = cols => cols.map((c,i)=> i===0 || colGroup(c)!==colGroup(cols[i-1]));
// fill: {rec} prints the saved scores and parsha names (copy for the teacher to review)
function sheetHtml(sh, monthLabel, fill, parsh){
  const L = sh.layout, logo = $('railLogo').src, gs = groupStarts(L.cols);
  const catCols = L.cols.filter(c=>c.type==='cat'), weekCols = L.cols.filter(c=>c.type==='week' && c.week===0);
  const n = Math.max(1, L.rows.length);
  const rowH = Math.min(0.46, 5.55/n), fs = rowH < 0.2 ? 11 : rowH < 0.26 ? 12.5 : 14;
  const rec = fill && fill.rec, par = parsh || (rec ? rec.parshiot : []);
  let g = `<tr class="g"><th rowspan="2" style="width:.32in;">#</th><th rowspan="2" style="width:1.85in;">שם התלמיד</th><th colspan="3" class="gs">נוכחות</th>`;
  if(catCols.length) g += `<th colspan="${catCols.length}" class="gs">ציונים חודשיים (1–10)</th>`;
  for(let w=0; w<L.weekCount; w++) if(weekCols.length) g += `<th colspan="${weekCols.length}" class="wk gs">שבוע ${w+1}<span class="p">${par[w] ? `<b class="pf">${esc(par[w])}</b>` : 'פרשה: <span></span>'}</span></th>`;
  let s = '<tr class="s">' + L.cols.map((c,i)=>`<th class="${gs[i]?'gs':''}">${esc(c.type==='chesarim'?'חסר':c.type==='ichurim'?'איחור':c.type==='yatza'?'יצא מוקדם':c.he)}</th>`).join('');
  const body = L.rows.map((r,i)=>{
    const d = rec && rec.perStudent[r.sid];
    return `<tr style="height:${rowH}in;"><td class="no">${i+1}</td><td class="nm" style="font-size:${fs}px;">${esc(r.nameHe)}</td>${L.cols.map((c,ci)=>`<td class="${gs[ci]?'gs':''}${fill?' val':''}">${d ? esc(cellValue(d, c)||'') : ''}</td>`).join('')}</tr>`;
  }).join('');
  const right = fill ? `<div class="sh-review">לבדיקת המלמד</div>` : `<div class="sh-code">${qrImg(sh.code+'-P1')}${esc(sh.code+'-P1')}</div>`;
  return `<div class="sheet">${fill?'':'<i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>'}
    <div class="sh-head"><img class="sh-logo" src="${logo}" alt=""><div class="sh-titles"><div class="sh-title">גליון הערכה · ${esc(monthLabel)}</div>
      <div class="sh-sub">כתה <b>${esc(L.classHe)}</b>${L.teacherHe?` · המלמד <b>${esc(L.teacherHe)}</b>`:''}</div></div>${right}</div>
    <table class="sh"><thead>${g}</tr>${s}</tr></thead><tbody>${body}</tbody></table>
    <div class="sh-foot"><span>ציונים שבועיים 0–100 · ציונים חודשיים 1–10 · נוכחות: מספר הפעמים</span><span>ישיבה גדילת תורה</span></div></div>`;
}
// filled copy built from today's scores (no QR – not for scanning)
function reviewSheetHtml(cls, monthId){ const m = monthById(monthId); return sheetHtml({code:'', layout: sheetLayout(cls, monthId)}, m ? m.label : '', {rec: recFor(cls.id, monthId)}, parshiotFor(cls.id, monthId)); }
function sheetsHtml(keys){ return keys.map(k=>{ const sh = st.sheets[k], m = monthById(k.split('::')[1]); return sh && m ? sheetHtml(sh, m.label, null, parshiotFor(k.split('::')[0], m.id)) : ''; }).join(''); }
function sheetDocs(keys){ return keys.filter(k=>st.sheets[k]).map(k=>{ const c = classById(k.split('::')[0]), m = monthById(k.split('::')[1]); return {name: 'גליון הערכה '+heName(c)+' '+(m?m.label:''), label: heName(c), html: sheetsHtml([k])}; }); }
function printSheets(keys){ const h = sheetsHtml(keys); if(h) printHtml('Assessments', SHEET_PRINT_HEAD, h); }
function downloadSheets(keys, name){ const docs = sheetDocs(keys); if(docs.length) askPdf(docs, {name, title:'Making assessment PDF', unit:'classes', css:SHEET_CSS, landscape:true, selector:'.sheet'}); }
function previewSheets(keys, title){
  const h = sheetsHtml(keys); if(!h) return;
  openModal(`<div class="card-head"><h2 style="margin:0;">${esc(title)}</h2><span class="sp"></span><button class="btn sec sm" data-a="print">${ICON.print}Print</button><button class="btn sec sm" data-a="pdf">${ICON.download}PDF</button><button class="btn sm" data-a="close">Close</button></div>
    <style>${SHEET_CSS}</style><div id="shPv" style="background:#e9eeee;padding:12px;border-radius:8px;"></div>`, box=>{
    const pv = $('shPv'); pv.innerHTML = h;
    const sc = Math.min(1, (pv.clientWidth-24)/1056);
    pv.querySelectorAll('.sheet').forEach(s=>{ const wrap = document.createElement('div'); wrap.style.cssText = `width:${1056*sc}px;height:${816*sc}px;margin:0 auto 12px;box-shadow:0 2px 10px rgba(0,0,0,.15);overflow:hidden;`; s.parentNode.insertBefore(wrap, s); wrap.appendChild(s); s.style.transform = `scale(${sc})`; s.style.transformOrigin = 'top left'; });
    box.querySelector('[data-a=close]').onclick = closeModal;
    box.querySelector('[data-a=print]').onclick = ()=>printSheets(keys);
    box.querySelector('[data-a=pdf]').onclick = ()=>downloadSheets(keys, title);
  }, true);
}

/* ---------- page ---------- */
function sheetActs(attr, state, label){
  if(state==='none') return `<button class="btn sm" ${attr}="gen">${ICON.gen}Generate</button>`;
  return iconBtn('view','Preview',`${attr}="preview"`) + iconBtn('print','Print',`${attr}="print"`) + iconBtn('download','Download PDF',`${attr}="pdf"`)
    + `<button type="button" class="icon-btn ${state==='stale'?'warn-ic':''}" data-tip="${state==='stale'?'Changed since generated – regenerate':'Regenerate'}" ${attr}="regen">${ICON.redo}</button>`
    + iconBtn('trash','Ungenerate',`${attr}="ungen"`,'danger');
}
function renderAssessments(){
  const P = $('panel-assessments'), months = sortedMonths(), classes = sheetClasses();
  if(!months.some(m=>m.id===assessMonthId)){
    const gen = months.filter(m=> classes.some(c=>st.sheets[gradeKey(c.id,m.id)]));
    assessMonthId = (gen[gen.length-1] || months.find(m=>!classes.every(c=>monthHasScores(c.id,m.id))) || months[0] || {}).id || '';
  }
  const cards = months.map(m=>{
    const states = classes.map(c=>sheetState(c, m.id));
    const gen = states.filter(s=>s!=='none').length, scanned = states.filter(s=>s==='scanned').length, stale = states.filter(s=>s==='stale').length;
    const sub = gen ? `${gen}/${classes.length} generated · ${scanned} scanned` : 'Not generated';
    const state = !gen ? 'none' : stale ? 'stale' : 'generated';
    return `<div class="mcard ${m.id===assessMonthId?'sel':''} ${stale?'stale':''}" data-m="${m.id}"><div class="m">${esc(m.label)}</div><div class="s">${sub}</div><div class="acts">${classes.length ? sheetActs('data-mact', state) : ''}</div></div>`;
  }).join('');
  const month = monthById(assessMonthId);
  let parRow = '';
  if(month && classes.length){
    const wc = Math.max(4, ...classes.map(c=>{ const r = recFor(c.id, month.id); return r ? r.weekCount : 4; }));
    const par = parshiotFor(classes[0].id, month.id), plan = weekPlan(classes[0].id, month), mc = plan.cal, ed = canEdit(), prevM = nearMonth(month, -1);
    const usedSet = new Set(plan.list), movedSet = new Set(mc.avail.slice(0, plan.dropIn));
    const shab = mc.all.length ? `<div class="shab-row"><span class="lbl">שבתות</span>${mc.all.map((p,i)=>{
        const mv = movedSet.has(p), on = usedSet.has(p), off = !mv && !on;
        const tip = mv ? 'In week 5 of '+prevM.label : mc.skip.includes(i) ? 'Skipped – click to use this week' : off ? 'Not used – add week 5 to use it' : 'Click to skip this week';
        return `<button type="button" class="shab ${off?'off':''} ${mv?'moved':''}" data-shab="${i}" ${ed?'':'disabled'} data-tip="${esc(tip)}">${mv?'↶ ':on?'✓ ':''}${esc(p)}</button>`; }).join('')}</div>` : '';
    const w5 = ed ? (wc<5 ? `<button type="button" class="btn sec sm" data-w5="add">+ שבוע 5</button>` : `<button type="button" class="btn sec sm" data-w5="remove">× שבוע 5</button>`) : '';
    parRow = `<div class="par-set" dir="rtl">${shab}<div class="wk-row"><span class="lbl">פרשיות</span>${Array.from({length:wc}, (_,w)=>`<label data-tip="שבוע ${w+1}"><span>${w+1}</span><input type="text" class="parsha-all" data-idx="${w}" dir="rtl" value="${esc(par[w]||'')}" ${ed?'':'readonly'}></label>`).join('')}${w5}</div></div>`;
  }
  const detail = month ? `<div class="card"><div class="card-head"><h2 class="he">${esc(month.label)}</h2></div>${parRow}
    ${classes.length ? `<table class="t"><thead><tr><th>Class</th><th>Teacher</th><th>Students</th><th>Sheet</th><th></th></tr></thead><tbody>${classes.map(c=>{
      const s = sheetState(c, month.id), sh = st.sheets[gradeKey(c.id, month.id)];
      return `<tr data-cid="${esc(c.id)}"><td>${he(heName(c))}</td><td>${he(heName(teacherOf(c)))}</td><td>${studentsOf(c.id).length}</td>
        <td>${STATE_TAG[s]} ${sh?`<span class="muted small" style="font-family:monospace;">${esc(sh.code)}</span>`:''}</td><td class="act">${sheetActs('data-cact', s)}</td></tr>`;
    }).join('')}</tbody></table>` : '<div class="empty">Add classes and students first</div>'}</div>` : '';
  P.innerHTML = pageHead('Assessments', `<button class="btn" id="scanBtn">${ICON.scan}Scan sheets</button>`) +
    `<div id="scanArea"></div><div class="month-cards">${cards}</div>${detail}`;
  $('scanBtn').addEventListener('click', ()=>{ if(!aiKey()){ noKeyNotice(); return; } $('scanFileInput').click(); });
  P.querySelectorAll('.parsha-all').forEach(inp=> inp.addEventListener('input', ()=>{
    if(!canEdit()) return;
    const i = +inp.dataset.idx, v = inp.value.trim();
    sheetClasses().forEach(c=>{ const cal = weekParshiot(c.id, month)[i] || ''; getGradeRecord(c.id, month.id).parshiot[i] = v===cal ? '' : v; });
    saveAll('Parshiot', month.label);
  }));
  // weeks that only had the calendar parsha follow the new order; typed-in ones stay
  const setSkip = skip => { month.skip = skip.slice().sort((a,c)=>a-c); };
  // typed-in weeks that only repeat the calendar are cleared, so they follow the new order (this month and the next)
  const freeTyped = () => [month, nearMonth(month, 1)].filter(Boolean).forEach(m=> sheetClasses().forEach(c=>{
    const r = recFor(c.id, m.id); if(!r) return; const cal = weekParshiot(c.id, m); r.parshiot = r.parshiot.map((p,k)=> p===cal[k] ? '' : p); }));
  // sheets not scanned yet follow the new week count (same code); scanned ones show "Changed since generated"
  const setWeeks = n => sheetClasses().forEach(c=>{
    getGradeRecord(c.id, month.id).weekCount = n;
    const sh = st.sheets[gradeKey(c.id, month.id)];
    if(sh && !sh.scannedAt){ sh.layout = sheetLayout(c, month.id); sh.sig = layoutSig(sh.layout); }
  });
  P.querySelectorAll('[data-shab]').forEach(b=> b.addEventListener('click', ()=>{
    if(!canEdit()) return;
    const c0 = sheetClasses()[0], plan = weekPlan(c0.id, month), i = +b.dataset.shab, name = plan.cal.all[i];
    if(plan.cal.avail.slice(0, plan.dropIn).includes(name)){ toast('This Shabbos is week 5 of '+nearMonth(month,-1).label); return; }
    freeTyped();
    const skip = plan.cal.skip.slice(), used = plan.list.includes(name);
    let act;
    if(skip.includes(i)){ skip.splice(skip.indexOf(i), 1); act = 'Add Shabbos'; }
    else if(used){ skip.push(i); act = 'Skip Shabbos'; }
    else { setWeeks(5); act = 'Add week 5'; }      // the 5th Shabbos, not used yet
    if(act!=='Add week 5'){ setSkip(skip); const left = monthCal(month).avail.length - plan.dropIn; setWeeks(left>4 ? 5 : 4); }
    saveAll(act, month.label + ' · ' + name); renderAssessments();
  }));
  P.querySelectorAll('[data-w5]').forEach(b=> b.addEventListener('click', ()=>{
    if(!canEdit()) return;
    freeTyped();
    const add = b.dataset.w5==='add';
    setWeeks(add ? 5 : 4);
    saveAll(add ? 'Add week 5' : 'Remove week 5', month.label); renderAssessments();
  }));
  P.querySelectorAll('.mcard').forEach(card=> card.addEventListener('click', e=>{ if(e.target.closest('button')) return; assessMonthId = card.dataset.m; renderAssessments(); }));
  P.querySelectorAll('[data-mact]').forEach(b=> b.addEventListener('click', async e=>{
    e.stopPropagation();
    const m = monthById(b.closest('.mcard').dataset.m); assessMonthId = m.id;
    const keys = sheetClasses().map(c=>gradeKey(c.id, m.id)), have = keys.filter(k=>st.sheets[k]);
    const a = b.dataset.mact;
    if(a==='gen'){ sheetClasses().forEach(c=>{ if(!st.sheets[gradeKey(c.id, m.id)]) generateSheet(c, m.id); }); saveAll('Generate assessments', m.label); flushNow(); renderAssessments(); toast('Sheets generated for '+m.label); }
    else if(a==='preview') previewSheets(have, 'Assessments '+m.label);
    else if(a==='print') printSheets(have);
    else if(a==='pdf') downloadSheets(have, 'Assessments '+m.label);
    else if(a==='regen'){
      if(!await askConfirm('Regenerate '+m.label+'?', 'Sheets get a new code. Print and hand out the new ones.', 'Regenerate', '')) return;
      sheetClasses().forEach(c=>generateSheet(c, m.id)); saveAll('Regenerate assessments', m.label); doneWithUndo('Sheets regenerated'); renderAssessments();
    } else if(a==='ungen'){
      if(!await askConfirm('Ungenerate '+m.label+'?', 'The sheets are removed. Scores are not touched.', 'Ungenerate')) return;
      keys.forEach(k=>delete st.sheets[k]); saveAll('Ungenerate assessments', m.label); doneWithUndo('Sheets removed'); renderAssessments();
    }
  }));
  P.querySelectorAll('[data-cact]').forEach(b=> b.addEventListener('click', async ()=>{
    const cls = classById(b.closest('tr').dataset.cid), key = gradeKey(cls.id, month.id), lbl = enName(cls)+' · '+month.label, a = b.dataset.cact;
    if(a==='gen'){ generateSheet(cls, month.id); saveAll('Generate assessment', lbl); flushNow(); renderAssessments(); }
    else if(a==='preview') previewSheets([key], 'Assessment '+enName(cls)+' '+month.label);
    else if(a==='print') printSheets([key]);
    else if(a==='pdf') downloadSheets([key], 'Assessment '+enName(cls)+' '+month.label);
    else if(a==='regen'){ if(!await askConfirm('Regenerate '+lbl+'?', 'The sheet gets a new code.', 'Regenerate', '')) return; generateSheet(cls, month.id); saveAll('Regenerate assessment', lbl); doneWithUndo('Sheet regenerated'); renderAssessments(); }
    else if(a==='ungen'){ if(!await askConfirm('Ungenerate '+lbl+'?', 'Scores are not touched.', 'Ungenerate')) return; delete st.sheets[key]; saveAll('Ungenerate assessment', lbl); doneWithUndo('Sheet removed'); renderAssessments(); }
  }));
  renderScanArea();
}
function noKeyNotice(){
  openModal(`<h2>Add your Claude API key</h2><p>Scanning reads the sheets with Claude, using your API credits.</p><div class="actions"><button class="btn sec" data-a="no">Cancel</button><button class="btn" data-a="go">Settings → AI Scanning</button></div>`, box=>{
    box.querySelector('[data-a=no]').onclick = closeModal;
    box.querySelector('[data-a=go]').onclick = ()=>{ closeModal(); settingsTab = 'ai'; activateTab('settings'); };
  });
}

/* ---------- Claude ---------- */
const aiKey = () => { if(CLOUD) return secrets.key || ''; try{ return localStorage.getItem('gh:ai-key') || ''; }catch(e){ return ''; } };
const aiModel = () => { if(CLOUD) return secrets.model || 'claude-opus-5-5'; try{ return localStorage.getItem('gh:ai-model') || 'claude-opus-5-5'; }catch(e){ return 'claude-opus-5-5'; } };
async function aiCall(content, maxTokens){
  const key = aiKey(); if(!key){ const e = new Error('No API key'); e.nokey = true; throw e; }
  let res;
  try{
    res = await fetch('https://api.anthropic.com/v1/messages', {method:'POST', headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body: JSON.stringify({model: aiModel(), max_tokens: maxTokens||4000, messages:[{role:'user', content}]})});
  }catch(e){ throw new Error('Could not reach Claude. Check the internet connection.'); }
  let body = null; try{ body = await res.json(); }catch(e){}
  if(!res.ok){
    let msg = body && body.error && body.error.message || ('HTTP '+res.status);
    if(res.status===402 || /credit balance|purchase credits|billing/i.test(msg)){ const ce = new Error(CREDITS_MSG); ce.credits = true; throw ce; }
    if(res.status===401) msg = 'The API key was rejected. Check it in Settings → AI Scanning.';
    throw new Error(msg);
  }
  return (body && body.content || []).filter(b=>b.type==='text').map(b=>b.text).join('\n');
}
function aiJson(text){ const t = String(text||'').replace(/```(?:json)?/g,''), a = t.indexOf('{'), b = t.lastIndexOf('}'); if(a<0 || b<a) throw new Error('Claude did not return a readable answer'); return JSON.parse(t.slice(a, b+1)); }
function canvasJpeg(canvas, maxSide, q){
  const s = Math.min(1, (maxSide||2000)/Math.max(canvas.width, canvas.height)), c = document.createElement('canvas');
  c.width = Math.round(canvas.width*s); c.height = Math.round(canvas.height*s);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(canvas,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg', q||.9).split(',')[1];
}
const loaded = {};
function loadScript(src, globalName){
  if(window[globalName]) return Promise.resolve();
  if(loaded[src]) return loaded[src];
  return loaded[src] = new Promise((res, rej)=>{ const s = document.createElement('script'); s.src = src; s.onload = ()=>res(); s.onerror = ()=>{ delete loaded[src]; rej(new Error('Could not load '+src)); }; document.head.appendChild(s); });
}
async function detectQr(canvas){
  try{
    await loadScript('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js', 'jsQR');
    const tries = [canvas];
    const crop = (x,y,w,h,sc)=>{ const c = document.createElement('canvas'); c.width = Math.round(w*sc); c.height = Math.round(h*sc); c.getContext('2d').drawImage(canvas, x,y,w,h, 0,0,c.width,c.height); return c; };
    const W = canvas.width, H = canvas.height;
    tries.push(crop(0,0,W*.4,H*.4,1.5), crop(W*.6,0,W*.4,H*.4,1.5), crop(0,H*.6,W*.4,H*.4,1.5), crop(W*.6,H*.6,W*.4,H*.4,1.5));
    for(const c of tries){
      const im = c.getContext('2d').getImageData(0,0,c.width,c.height);
      const r = window.jsQR(im.data, im.width, im.height, {inversionAttempts:'attemptBoth'});
      if(r && r.data) return r.data;
    }
  }catch(e){}
  return null;
}
async function aiReadCode(canvas){
  const txt = await aiCall([{type:'image', source:{type:'base64', media_type:'image/jpeg', data:canvasJpeg(canvas,1400,.85)}},
    {type:'text', text:'This is a scanned assessment sheet. In the top corner, under a QR code, there is a printed code like "GH-ABCDE-P1". Reply with JSON only: {"code":"<the code exactly, or empty string if not visible>"}'}], 200);
  return String(aiJson(txt).code||'').trim();
}
function colDescription(c){
  if(c.type==='chesarim') return 'Absent (חסר) – number of days, whole number';
  if(c.type==='ichurim') return 'Late (איחור) – number of times, whole number';
  if(c.type==='yatza') return 'Left early (יצא מוקדם) – number of times, whole number';
  if(c.type==='cat') return `monthly score "${c.he}" – a number from 1 to 10`;
  return `week ${c.week+1}, "${c.he}" – a score from 0 to 100`;
}
async function aiReadSheet(canvas, sh, page){
  const L = sh.layout, rows = L.rows.slice((page-1)*ROWS_PER_PAGE, page*ROWS_PER_PAGE);
  const roster = rows.map((r,i)=>`${i+1}. ${r.nameHe}`).join('\n');
  const cols = L.cols.map((c,i)=>`"c${i}" = ${colDescription(c)}`).join('\n');
  const prompt = `You are reading a scanned, hand-filled Hebrew class assessment sheet (it may be rotated or skewed – read it in whatever orientation it is in).
The table is right-to-left. Each row is one student. The four black squares at the corners are alignment markers – ignore them.
The students, in printed order top to bottom (the printed row number is before each name):
${roster}

After the "#" and student-name columns, the score columns, reading from RIGHT to LEFT, are:
${cols}

Above each week's columns there is a line "פרשה:" where the teacher may have written the name of the parsha in Hebrew.

Rules:
- Read every row's own handwriting separately. Never copy one row's numbers into another row.
- A blank cell must be left out. Never guess a value for an empty box.
- Common confusions: 1 vs 7, 4 vs 9, 5 vs 6 vs 8, 0 vs 6. If you can read a number but are not fully sure, still give it and set "sure": false.
- Numbers only (digits), no words.

Reply with JSON only, no prose:
{"code":"<printed code under the QR, e.g. GH-ABCDE-P1>","parsha":{"1":"<week 1 parsha or empty>"},"rows":[{"row":1,"name":"<printed name>","cells":{"c0":{"v":2,"sure":true}}}]}
Include one entry per printed student row (rows with nothing written may have empty "cells").`;
  const txt = await aiCall([{type:'image', source:{type:'base64', media_type:'image/jpeg', data:canvasJpeg(canvas,2300,.92)}}, {type:'text', text:prompt}], 8000);
  const out = aiJson(txt), outRows = Array.isArray(out.rows) ? out.rows : [];
  const norm = s => String(s||'').replace(/[^א-תa-zA-Z0-9]/g,'');
  const values = {}, unsure = {};
  rows.forEach((r,i)=>{
    const want = norm(r.nameHe), dup = rows.filter(z=>norm(z.nameHe)===want).length>1;
    const row = outRows.find(x=>Number(x.row)===i+1) || (!dup && outRows.find(x=>norm(x.name)===want)) || null;
    if(!row || !row.cells) return;
    Object.entries(row.cells).forEach(([k, cell])=>{
      const ci = Number(String(k).replace(/^c/,'')); if(!(ci>=0 && ci<L.cols.length)) return;
      const v = cell && typeof cell==='object' ? cell.v : cell;
      if(v===null || v===undefined || String(v).trim()==='') return;
      const val = String(v).trim();
      (values[r.sid] = values[r.sid] || {})[ci] = val;
      if((cell && cell.sure===false) || !validCell(L.cols[ci], val)) (unsure[r.sid] = unsure[r.sid] || {})[ci] = true;
    });
  });
  const parsha = {};
  if(out.parsha && typeof out.parsha==='object') Object.entries(out.parsha).forEach(([w,t])=>{ const n = Number(w); if(n>=1 && n<=5 && String(t||'').trim()) parsha[n-1] = String(t).trim(); });
  return {values, unsure, parsha, code: out.code};
}

/* ---------- files → page images ---------- */
async function fileToCanvases(file){
  const out = [];
  if(/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)){
    await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', 'pdfjsLib');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    const pdf = await window.pdfjsLib.getDocument({data: new Uint8Array(await file.arrayBuffer())}).promise;
    for(let n=1; n<=pdf.numPages; n++){
      const page = await pdf.getPage(n), v = page.getViewport({scale:2.2}), c = document.createElement('canvas');
      c.width = Math.round(v.width); c.height = Math.round(v.height);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,c.width,c.height);
      await page.render({canvasContext:ctx, viewport:v}).promise;
      out.push({canvas:c, name: file.name+(pdf.numPages>1?' · p'+n:'')});
    }
  } else {
    const url = URL.createObjectURL(file);
    const img = await new Promise((res, rej)=>{ const i = new Image(); i.onload = ()=>res(i); i.onerror = ()=>rej(new Error('Could not open '+file.name)); i.src = url; });
    const s = Math.min(1, 2600/Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth*s); c.height = Math.round(img.naturalHeight*s);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height);
    URL.revokeObjectURL(url);
    out.push({canvas:c, name:file.name});
  }
  return out;
}
$('scanFileInput').addEventListener('change', async e=>{
  const files = Array.from(e.target.files||[]); e.target.value = '';
  if(!files.length) return;
  if(!scan) scan = {pages:[], sel:null, busy:false, stop:false};
  for(const f of files){
    try{
      const pages = await fileToCanvases(f);
      pages.forEach(p=> scan.pages.push({id:uid(), name:p.name, canvas:p.canvas, img:p.canvas.toDataURL('image/jpeg',.8), status:'queued'}));
    }catch(err){ scan.pages.push({id:uid(), name:f.name, status:'error', error: err.message}); }
  }
  if(!scan.sel && scan.pages.length) scan.sel = scan.pages[0].id;
  renderScanArea();
  processQueue();
});
async function processQueue(){
  if(!scan || scan.busy) return;
  scan.busy = true; scan.stop = false;
  for(const pg of scan.pages){
    if(scan.stop) break;
    if(pg.status!=='queued') continue;
    pg.status = 'reading'; pg.error = ''; renderScanArea();
    try{
      if(!pg.key){
        let code = await detectQr(pg.canvas);
        let found = code && findSheetByCode(code);
        if(!found){ code = await aiReadCode(pg.canvas); found = code && findSheetByCode(code); }
        if(!found){ pg.status = 'nomatch'; renderScanArea(); continue; }
        pg.key = found.key; pg.page = found.page;
      }
      const sh = st.sheets[pg.key];
      if(!sh){ pg.status = 'nomatch'; pg.key = null; renderScanArea(); continue; }
      const r = await aiReadSheet(pg.canvas, sh, pg.page);
      Object.assign(pg, {values:r.values, unsure:r.unsure, parsha:r.parsha, status:'ready'});
    }catch(err){
      pg.status = 'error'; pg.error = err.message;
      if(err.credits || err.nokey){ scan.stop = true; scan.notice = err.message; }
    }
    renderScanArea();
  }
  scan.busy = false; renderScanArea();
}
function pageProblems(pg){
  if(pg.status!=='ready') return 0;
  let n = 0; Object.values(pg.unsure||{}).forEach(o=>{ n += Object.keys(o).length; }); return n;
}
function chipDot(pg){
  if(pg.status==='reading') return 'busy';
  if(pg.status==='saved') return 'ok';
  if(pg.status==='error' || pg.status==='nomatch') return 'bad';
  if(pg.status==='ready') return pageProblems(pg) ? 'warn' : 'ok';
  return '';
}
function pageTitle(pg){
  if(!pg.key) return pg.name;
  const [cid, mid] = pg.key.split('::'), c = classById(cid), m = monthById(mid), sh = st.sheets[pg.key];
  const nPages = sh ? Math.max(1, Math.ceil(sh.layout.rows.length/ROWS_PER_PAGE)) : 1;
  return (c ? enName(c) : '?') + ' · ' + (m ? m.label : '') + (nPages>1 ? ' · p'+pg.page : '');
}
function pageTitleHtml(pg){
  if(!pg.key) return esc(pg.name);
  const [cid, mid] = pg.key.split('::'), c = classById(cid), m = monthById(mid), sh = st.sheets[pg.key];
  const nPages = sh ? Math.max(1, Math.ceil(sh.layout.rows.length/ROWS_PER_PAGE)) : 1;
  return esc(c ? enName(c) : '?') + ' · <bdi>' + esc(m ? m.label : '') + '</bdi>' + (nPages>1 ? ' · p'+pg.page : '');
}
function renderScanArea(){
  const box = $('scanArea'); if(!box) return;
  if(!scan || !scan.pages.length){ box.innerHTML = ''; return; }
  const total = scan.pages.length, done = scan.pages.filter(p=>!['queued','reading'].includes(p.status)).length;
  const ready = scan.pages.filter(p=>p.status==='ready');
  const pg = scan.pages.find(p=>p.id===scan.sel) || scan.pages[0];
  let detail = '';
  if(pg.status==='queued' || pg.status==='reading') detail = `<div class="notice">Reading ${esc(pg.name)}…</div>`;
  else if(pg.status==='error') detail = `<div class="notice bad">${esc(pg.error||'Could not read this page')}</div><div class="row"><button class="btn sec sm" data-sa="retry">Try again</button><button class="btn sec sm" data-sa="drop">Remove</button></div>`;
  else if(pg.status==='nomatch'){
    const opts = []; Object.keys(st.sheets).forEach(k=>{ const sh = st.sheets[k], [cid, mid] = k.split('::'), c = classById(cid), m = monthById(mid); if(!c||!m) return; const n = Math.max(1, Math.ceil(sh.layout.rows.length/ROWS_PER_PAGE)); for(let p=1;p<=n;p++) opts.push({v:k+'|'+p, l: enName(c)+' · '+m.label+(n>1?' · page '+p:'')}); });
    detail = `<div class="notice warn">The sheet code couldn't be read. Pick which sheet this is.</div>
      <div class="review"><div class="img"><img src="${pg.img}" alt=""></div><div><div class="row"><select id="pickSheet">${opts.map(o=>`<option value="${esc(o.v)}">${esc(o.l)}</option>`).join('')}</select><button class="btn" data-sa="read" ${opts.length?'':'disabled'}>Read</button><button class="btn sec" data-sa="drop">Remove</button></div></div></div>`;
  } else {
    const sh = st.sheets[pg.key], [cid, mid] = pg.key.split('::'), cls = classById(cid), month = monthById(mid);
    if(!sh || !cls || !month){ detail = `<div class="notice bad">This sheet was ungenerated.</div><button class="btn sec sm" data-sa="drop">Remove</button>`; }
    else {
      const L = sh.layout, rows = L.rows.slice((pg.page-1)*ROWS_PER_PAGE, pg.page*ROWS_PER_PAGE), gsR = groupStarts(L.cols);
      const rec = recFor(cls.id, month.id);
      const parsh = []; for(let w=0; w<L.weekCount; w++) parsh[w] = parshiotFor(cls.id, month.id)[w] || '';
      const problems = pageProblems(pg);
      detail = `${pg.status==='saved'?'<div class="notice">Saved to scores. You can still edit them on the Scores page.</div>':''}
        <div class="review"><div class="img" id="scanImg"><img src="${pg.img}" alt=""></div>
        <div style="min-width:0;">
          <div class="card-head"><h2>${pageTitleHtml(pg)}</h2>${problems?`<span class="tag warn">${problems} to check</span>`:'<span class="tag ok">Looks good</span>'}<span class="sp"></span>
            ${pg.status==='ready'?`<button class="btn" data-sa="save">${ICON.check}Save to scores</button>`:''}${iconBtn('trash','Remove from this scan','data-sa="drop"','danger')}</div>
          <div class="grid-wrap" dir="rtl"><table class="entry rtl"><thead>${reviewHead(L, parsh)}</thead><tbody>${rows.map((r,ri)=>{
            const s = studentsOf(cls.id).find(x=>x.id===r.sid), d = rec && rec.perStudent[r.sid];
            return `<tr><td class="name">${esc(r.nameHe)}${s?'':' <span class="tag bad">Removed</span>'}</td>${L.cols.map((c,ci)=>{
              const v = ((pg.values||{})[r.sid]||{})[ci] || '', un = ((pg.unsure||{})[r.sid]||{})[ci], old = d ? (cellValue(d, c)||'') : '';
              const cls2 = (!validCell(c, v) ? 'bad' : (un ? 'unsure' : '')) + (gsR[ci] ? ' gs' : '');
              return `<td class="${cls2}" ${un?'data-tip="Needs review"':''}><input type="text" data-sid="${esc(r.sid)}" data-ci="${ci}" value="${esc(v)}" placeholder="${esc(old)}" ${pg.status==='saved'?'disabled':''}></td>`;
            }).join('')}</tr>`; }).join('')}</tbody></table></div>
          <div class="muted small" style="margin-top:6px;">Grey numbers are what's already saved. Blank boxes keep them.</div>
        </div></div>`;
    }
  }
  box.innerHTML = `<div class="card">
    <div class="card-head"><h2>Scan</h2><span class="muted small">${done}/${total} read</span><span class="sp"></span>
      <button class="btn sec sm" id="scanMore">${ICON.plus}Add pages</button>
      ${ready.length>1?`<button class="btn sm" id="saveAllScans">${ICON.check}Save all without problems</button>`:''}
      <button class="btn sec sm" id="closeScan">Close</button></div>
    ${scan.notice?`<div class="notice bad">${esc(scan.notice)}</div>`:''}
    ${scan.busy?`<div class="progress"><div style="width:${Math.round(done/total*100)}%"></div></div><br>`:''}
    <div class="scan-chips">${scan.pages.map(p=>`<button class="scan-chip ${p.id===pg.id?'sel':''}" data-pid="${p.id}"><span class="d ${chipDot(p)}"></span>${pageTitleHtml(p)}${p.status==='ready'&&pageProblems(p)?` · ${pageProblems(p)}`:''}</button>`).join('')}</div>
    ${detail}</div>`;
  $('scanMore').onclick = ()=>{ if(!aiKey()){ noKeyNotice(); return; } $('scanFileInput').click(); };
  $('closeScan').onclick = async ()=>{ const unsaved = scan.pages.filter(p=>p.status==='ready').length; if(unsaved && !await askConfirm('Close the scan?', unsaved+' page(s) are not saved yet.', 'Close')) return; scan.stop = true; scan = null; renderScanArea(); };
  if($('saveAllScans')) $('saveAllScans').onclick = ()=>{ let n = 0; scan.pages.forEach(p=>{ if(p.status==='ready' && !pageProblems(p)){ saveScanPage(p, true); n++; } }); flushNow(); toast(n ? n+' page(s) saved' : 'Every page has something to check'); renderAssessments(); };
  box.querySelectorAll('.scan-chip').forEach(b=> b.onclick = ()=>{ scan.sel = b.dataset.pid; renderScanArea(); });
  const img = $('scanImg'); if(img) img.onclick = ()=> img.classList.toggle('zoom');
  box.querySelectorAll('[data-sa]').forEach(b=> b.onclick = ()=>{
    const a = b.dataset.sa;
    if(a==='drop'){ scan.pages = scan.pages.filter(p=>p.id!==pg.id); scan.sel = scan.pages[0] && scan.pages[0].id; if(!scan.pages.length) scan = null; renderScanArea(); }
    else if(a==='retry'){ pg.status = 'queued'; scan.notice = ''; processQueue(); }
    else if(a==='read'){ const [k, p] = $('pickSheet').value.split('|'); pg.key = k; pg.page = Number(p); pg.status = 'queued'; processQueue(); }
    else if(a==='save'){ saveScanPage(pg); flushNow(); toast('Saved to scores', true); renderAssessments(); }
  });
  box.querySelectorAll('tbody input').forEach(inp=> inp.addEventListener('input', ()=>{
    const sid = inp.dataset.sid, ci = +inp.dataset.ci, v = inp.value.trim();
    (pg.values[sid] = pg.values[sid] || {})[ci] = v;
    if(pg.unsure[sid]) delete pg.unsure[sid][ci];
    const td = inp.parentElement, col = st.sheets[pg.key].layout.cols[ci];
    td.classList.remove('unsure'); td.removeAttribute('data-tip'); td.classList.toggle('bad', !validCell(col, v));
  }));
  box.querySelectorAll('tbody input').forEach(inp=> inp.addEventListener('blur', ()=>{ const chip = box.querySelector(`.scan-chip[data-pid="${pg.id}"]`); if(chip) chip.innerHTML = `<span class="d ${chipDot(pg)}"></span>${pageTitleHtml(pg)}${pageProblems(pg)?' · '+pageProblems(pg):''}`; }));
}
function reviewHead(L, parsh){
  const catCols = L.cols.filter(c=>c.type==='cat'), weekCols = L.cols.filter(c=>c.type==='week' && c.week===0);
  let g = `<tr class="grp"><th rowspan="2">תלמיד</th><th colspan="3" class="gs">נוכחות</th>${catCols.length?`<th colspan="${catCols.length}" class="gs">ניקוד (1–10)</th>`:''}`;
  for(let w=0; w<L.weekCount; w++) if(weekCols.length) g += `<th colspan="${weekCols.length}" class="wkh gs"><div class="wk">שבוע ${w+1}</div><div class="parsha-ro">${esc(parsh[w]||'—')}</div></th>`;
  g += '</tr><tr>' + L.cols.map((c,i,a)=>`<th class="${i===0||colGroup(c)!==colGroup(a[i-1])?'gs':''}">${esc(c.he)}</th>`).join('');
  return g + '</tr>';
}
function saveScanPage(pg, quiet){
  const sh = st.sheets[pg.key]; if(!sh) return;
  const [cid, mid] = pg.key.split('::'), cls = classById(cid), month = monthById(mid); if(!cls || !month) return;
  const rec = getGradeRecord(cid, mid), L = sh.layout;
  const ids = new Set(studentsOf(cid).map(s=>s.id));
  Object.entries(pg.values||{}).forEach(([sid, cols])=>{
    if(!ids.has(sid)) return;
    if(!rec.perStudent[sid]) rec.perStudent[sid] = emptyStudentRecord(cls);
    const d = ensureRecordShape(rec.perStudent[sid], cls);
    Object.entries(cols).forEach(([ci, v])=>{
      v = String(v||'').trim(); if(v==='') return;
      const col = L.cols[+ci]; if(!col) return;
      setCellValue(d, col, v);
      if(col.type==='week' && col.week===4) rec.weekCount = 5;
    });
  });
  sh.scannedAt = Date.now();
  pg.status = 'saved';
  saveAll('Scan saved', pageTitle(pg));
}
