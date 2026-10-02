/**
 * TEMPORARY admin migration endpoint — Firestore -> Supabase (Phase 1).
 *
 * Phone-friendly alternative to the terminal script
 * (server/scripts/migrateFirestoreToSupabase.ts). Shares its core.
 *
 * Access:  GET /api/admin/supabase-migrate?token=<MIGRATION_TOKEN>
 * Requires: admin login (requireAdmin) + MIGRATION_TOKEN env var.
 *
 * Flow: open the page -> press "Start migration" -> progress streams live.
 * The job runs in the background; closing the page does not stop it.
 *
 * DELETE THIS FILE (and its registration in server/api/routes.ts) after the
 * migration is verified, then Republish.
 */
import express from 'express';
import { requireAdmin } from '../security/auth.js';
import { isSupabaseConfigured } from '../database/supabase.js';
import { runMigration, getSupabaseCounts, CollectionResult } from '../scripts/migrationCore.js';

interface JobState {
  status: 'idle' | 'running' | 'done' | 'error';
  startedAt: number | null;
  finishedAt: number | null;
  log: string[];
  results: CollectionResult[];
  error: string | null;
}

const job: JobState = { status: 'idle', startedAt: null, finishedAt: null, log: [], results: [], error: null };

function checkToken(req: express.Request, res: express.Response): boolean {
  const configured = process.env.MIGRATION_TOKEN;
  if (!configured || configured.length < 12) {
    res.status(503).json({ success: false, error: 'Migration not configured: MIGRATION_TOKEN env var missing.' });
    return false;
  }
  const given = String(req.query.token || req.body?.token || '');
  if (given !== configured) {
    res.status(403).json({ success: false, error: 'Bad migration token.' });
    return false;
  }
  return true;
}

function pushLog(line: string) {
  const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });
  job.log.push(`[${ts}] ${line}`);
  if (job.log.length > 400) job.log.splice(0, job.log.length - 400);
}

async function runJob() {
  if (job.status === 'running') return;
  job.status = 'running';
  job.startedAt = Date.now();
  job.finishedAt = null;
  job.results = [];
  job.error = null;
  job.log = [];
  pushLog('Migration started.');
  try {
    const results = await runMigration((e) => {
      if (e.type === 'collection' && e.result) {
        const r = e.result;
        pushLog(`${r.firestore}: read ${r.read}, mapped ${r.mapped}, skipped ${r.skipped}${r.error ? ' ERROR: ' + r.error : ''} -> ${r.table}`);
      } else if (e.type === 'batch' && e.plan) {
        pushLog(`... ${e.written}/${e.total} rows -> ${e.plan.table}`);
      } else if (e.type === 'error' && e.plan) {
        pushLog(`${e.plan.firestore}: FAILED: ${e.message}`);
      }
    });
    job.results = results;
    pushLog('All collections processed. Counting Supabase rows...');
    const counts = await getSupabaseCounts();
    for (const r of results) {
      const c = counts[r.table] ?? -1;
      pushLog(`[${c >= r.mapped ? 'OK' : 'LOW'}] ${r.table}: ${c} rows (migrated ${r.mapped})`);
    }
    job.status = 'done';
    pushLog('DONE. You can now delete this endpoint and Republish.');
  } catch (e: any) {
    job.status = 'error';
    job.error = e?.message || String(e);
    pushLog('JOB FAILED: ' + job.error);
  }
  job.finishedAt = Date.now();
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function registerAdminMigrateRoutes(apiRouter: express.Router) {
  // Phone-friendly status page
  apiRouter.get('/admin/supabase-migrate', requireAdmin, (req, res) => {
    if (!checkToken(req, res)) return;
    const token = esc(String(req.query.token || ''));
    const ready = isSupabaseConfigured();
    res.send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Supabase migration</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:16px;background:#0b0f14;color:#e6e6e6}
button{font-size:18px;padding:14px 22px;border-radius:10px;border:0;background:#2563eb;color:#fff;width:100%}
button:disabled{background:#444}#log{background:#111827;border-radius:10px;padding:12px;white-space:pre-wrap;font-size:13px;max-height:60vh;overflow:auto}
.warn{background:#3a2b00;border:1px solid #a16207;padding:10px;border-radius:8px;margin:12px 0}</style></head>
<body><h2>Firestore &rarr; Supabase migration</h2>
${ready ? '' : '<div class="warn">SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in this environment. Set them in AI Studio and Republish first.</div>'}
<div class="warn">Temporary tool. After DONE, tell the developer to remove it and Republish.</div>
<button id="start" ${ready ? '' : 'disabled'}>Start migration</button>
<h3>Progress</h3><div id="log">waiting…</div>
<script>
const token=${JSON.stringify(String(req.query.token || ''))};
async function poll(){try{const r=await fetch('/api/admin/supabase-migrate/status?token='+encodeURIComponent(token));const j=await r.json();
document.getElementById('log').textContent=(j.log||[]).join('\\n')||'waiting…';
const b=document.getElementById('start');if(j.status==='running')b.disabled=true;
if(j.status==='done'||j.status==='error')b.disabled=true;}catch(e){}setTimeout(poll,2000)}poll();
document.getElementById('start').onclick=async()=>{document.getElementById('start').disabled=true;
await fetch('/api/admin/supabase-migrate/start?token='+encodeURIComponent(token),{method:'POST'});poll();};
</script></body></html>`);
  });

  apiRouter.post('/admin/supabase-migrate/start', requireAdmin, (req, res) => {
    if (!checkToken(req, res)) return;
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ success: false, error: 'Supabase env vars not set.' });
    }
    if (job.status === 'running') return res.json({ success: true, alreadyRunning: true });
    runJob(); // background; do not await
    res.json({ success: true, started: true });
  });

  apiRouter.get('/admin/supabase-migrate/status', requireAdmin, (req, res) => {
    if (!checkToken(req, res)) return;
    res.json({
      success: true,
      status: job.status,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      error: job.error,
      results: job.results,
      log: job.log,
    });
  });
}
