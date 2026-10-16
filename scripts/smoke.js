const { createRun, reset } = require('../lib/engine');
(async()=>{ await reset(); const base=await createRun({mode:'baseline'}); const good=await createRun({mode:'repair',repair:'good'}); const bad=await createRun({mode:'repair',repair:'bad'}); console.log(JSON.stringify({baseline:base.verdict, good:good.verdict, bad:bad.verdict})); })().catch(e=>{console.error(e);process.exit(1)});
