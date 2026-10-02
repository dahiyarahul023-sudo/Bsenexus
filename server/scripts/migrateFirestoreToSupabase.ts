/**
 * Firestore -> Supabase one-time data migration (Phase 1) — terminal CLI.
 *
 * WHERE IT RUNS: needs BOTH Firebase Admin credentials AND
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars.
 *   npx tsx server/scripts/migrateFirestoreToSupabase.ts --dry-run   # counts only
 *   npx tsx server/scripts/migrateFirestoreToSupabase.ts --apply     # migrates
 *   npx tsx server/scripts/migrateFirestoreToSupabase.ts --verify    # recount Supabase
 *
 * Phone users: use the temporary admin page instead —
 *   /api/admin/supabase-migrate?token=<MIGRATION_TOKEN>   (admin login required)
 *
 * SAFETY: every write is an UPSERT on the PK -> re-runs are safe, nothing deleted.
 */
import { isSupabaseConfigured } from '../database/supabase.js';
import { dryRunMigration, runMigration, getSupabaseCounts } from './migrationCore.js';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');
  const verifyOnly = args.includes('--verify');

  if (!isSupabaseConfigured()) {
    console.error('MISSING: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars not set. Set them first, then re-run.');
    process.exit(2);
  }

  if (verifyOnly) {
    console.log('== Supabase row counts ==');
    const counts = await getSupabaseCounts();
    for (const [table, c] of Object.entries(counts)) console.log(`  ${table}: ${c}`);
    return;
  }

  console.log(dryRun ? '== DRY RUN (counts only, nothing written) ==' : '== APPLY (upserting into Supabase) ==');

  const onEvent = (e: any) => {
    if (e.type === 'collection' && e.result) {
      const r = e.result;
      console.log(`- ${r.firestore}: read ${r.read}, mapped ${r.mapped}, skipped ${r.skipped}${r.error ? ` ERROR: ${r.error}` : ''} -> ${r.table}`);
    } else if (e.type === 'batch') {
      console.log(`  ... ${e.written}/${e.total} rows -> ${e.plan.table}`);
    } else if (e.type === 'error') {
      console.log(`- ${e.plan.firestore}: FAILED: ${e.message}`);
    }
  };

  const results = dryRun ? await dryRunMigration(onEvent) : await runMigration(onEvent);

  if (!dryRun) {
    console.log('\n== Verify: Supabase row counts ==');
    const counts = await getSupabaseCounts();
    for (const r of results) {
      const c = counts[r.table] ?? -1;
      const mark = c >= r.mapped ? 'OK ' : 'LOW';
      console.log(`  [${mark}] ${r.table}: ${c} rows (migrated ${r.mapped})`);
    }
  } else {
    console.log('\nDry run done. Re-run with --apply to migrate.');
  }
}

main().catch((e) => {
  console.error('MIGRATION FAILED:', e?.message || e);
  process.exit(1);
});
