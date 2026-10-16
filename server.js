const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRun, readRuns, reset } = require('./lib/engine');
const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8' };
function send(res, code, body, type='application/json; charset=utf-8') { res.writeHead(code, {'content-type':type, 'cache-control':'no-store'}); res.end(type.startsWith('application/json') ? JSON.stringify(body) : body); }
async function body(req) { let s=''; for await (const chunk of req) s+=chunk; return s ? JSON.parse(s) : {}; }
const server=http.createServer(async (req,res)=>{
  try {
    const url=new URL(req.url, `http://${req.headers.host}`);
    if(req.method==='GET' && url.pathname==='/api/runs') return send(res,200,await readRuns());
    if(req.method==='POST' && url.pathname==='/api/verify/baseline') return send(res,201,await createRun({mode:'baseline'}));
    if(req.method==='POST' && url.pathname==='/api/verify/repair') { const b=await body(req); return send(res,201,await createRun({mode:'repair',repair:b.repair})); }
    if(req.method==='POST' && url.pathname==='/api/reset') return send(res,200,await reset());
    if(req.method==='GET') { const requested=url.pathname==='/'?'index.html':url.pathname.slice(1); const safe=path.normalize(requested); if(safe.startsWith('..')) return send(res,404,{error:'not found'}); const file=path.join(ROOT,safe); try { const content=await fs.readFile(file); return send(res,200,content,MIME[path.extname(file)]||'application/octet-stream'); } catch(error) { if(error.code==='ENOENT') return send(res,404,{error:'not found'}); throw error; } }
    send(res,404,{error:'not found'});
  } catch(error) { console.error(error); send(res,500,{error:error.message}); }
});
server.listen(PORT,()=>console.log(`PROOFLOOP listening on http://localhost:${PORT}`));
