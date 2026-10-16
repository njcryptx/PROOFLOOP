const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRun, readRuns, reset } = require('./lib/engine');
const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.ico':'image/x-icon' };
const MAX_BODY = 4096;
const PUBLIC_FILES = new Set(['index.html', 'styles.css', 'app.js']);
function send(res, code, body, type='application/json; charset=utf-8', extra={}) { res.writeHead(code, {'content-type':type, 'cache-control':'no-store', ...extra}); res.end(type.startsWith('application/json') ? JSON.stringify(body) : body); }
async function body(req) { let s=''; for await (const chunk of req) { s += chunk; if (s.length > MAX_BODY) throw Object.assign(new Error('Request body too large'), { statusCode: 413 }); } if (!s) return {}; try { return JSON.parse(s); } catch { throw Object.assign(new Error('invalid JSON'), { statusCode: 400 }); } }
function escapeHtml(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function reportHtml(run) { return `<!doctype html><meta charset="utf-8"><title>PROOFLOOP ${escapeHtml(run.runId)}</title><style>body{font:14px system-ui;max-width:900px;margin:40px auto;color:#18221e}pre{background:#f2f6f0;padding:14px;white-space:pre-wrap}.badge{padding:4px 8px;border-radius:4px;background:#e8f6cf}.fail{background:#fde8e4}</style><h1>PROOFLOOP verification report</h1><p><b>Verdict:</b> <span class="badge ${run.verdict==='FAIL'?'fail':''}">${escapeHtml(run.verdict)}</span></p><p><b>Run:</b> ${escapeHtml(run.runId)}<br><b>Timestamp:</b> ${escapeHtml(run.timestamp)}<br><b>Digest:</b> ${escapeHtml(run.evidenceDigest)}</p><h2>Timeline</h2><ul>${(run.timeline||[]).map(x=>`<li>${escapeHtml(x.label)} — ${escapeHtml(x.status)}</li>`).join('')}</ul><h2>Evidence</h2><pre>${escapeHtml(JSON.stringify(run,null,2))}</pre>`; }
const server=http.createServer(async (req,res)=>{
  try {
    const url=new URL(req.url, `http://${req.headers.host}`);
    if(req.method==='GET' && url.pathname==='/api/runs') {
      let runs=await readRuns(); const verdict=url.searchParams.get('verdict'); const test=url.searchParams.get('test'); const q=(url.searchParams.get('q')||'').toLowerCase();
      if(verdict && ['PASS','FAIL','ERROR'].includes(verdict)) runs=runs.filter(r=>r.verdict===verdict);
      if(test) runs=runs.filter(r=>JSON.stringify(r).includes(test));
      if(q) runs=runs.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
      return send(res,200,runs);
    }
    const reportMatch=url.pathname.match(/^\/api\/runs\/([^/]+)\/report\.(json|html)$/);
    if(req.method==='GET' && reportMatch) { const run=(await readRuns()).find(r=>r.runId===reportMatch[1]); if(!run) return send(res,404,{error:'run not found'}); if(reportMatch[2]==='html') return send(res,200,reportHtml(run),'text/html; charset=utf-8',{'content-disposition':`attachment; filename="${run.runId}.html"`}); return send(res,200,run,'application/json; charset=utf-8',{'content-disposition':`attachment; filename="${run.runId}.json"`}); }
    if(req.method==='POST' && url.pathname==='/api/verify/baseline') return send(res,201,await createRun({mode:'baseline'}));
    if(req.method==='POST' && url.pathname==='/api/verify/error') return send(res,201,await createRun({mode:'error'}));
    if(req.method==='POST' && url.pathname==='/api/verify/repair') { const b=await body(req); if(!b || !['good','bad'].includes(b.repair)) return send(res,400,{error:'repair must be good or bad'}); return send(res,201,await createRun({mode:'repair',repair:b.repair})); }
    if(req.method==='POST' && url.pathname==='/api/reset') return send(res,200,await reset());
    if(req.method==='GET') { const requested=url.pathname==='/'?'index.html':url.pathname.slice(1); const safe=path.normalize(requested); if(safe.startsWith('..') || !PUBLIC_FILES.has(safe)) return send(res,404,{error:'not found'}); const file=path.join(ROOT,safe); try { const content=await fs.readFile(file); return send(res,200,content,MIME[path.extname(file)]||'application/octet-stream'); } catch(error) { if(error.code==='ENOENT') return send(res,404,{error:'not found'}); throw error; } }
    send(res,404,{error:'not found'});
  } catch(error) { if(!error.statusCode || error.statusCode >= 500) console.error(error); send(res,error.statusCode||500,{error:error.message}); }
});
server.listen(PORT,()=>console.log(`PROOFLOOP listening on http://localhost:${PORT}`));
