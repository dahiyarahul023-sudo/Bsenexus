import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { PRO_PLANS } from '../config/plans.js';
import { PRO_PLAN_LIST } from '../../src/config/plans.js';

/**
 * Pricing single source of truth.
 *
 * Charge truth:  server/config/plans.ts  (PRO_PLANS — what Cashfree charges)
 * Display truth: src/config/plans.ts     (PRO_PLAN_LIST — what the UI shows)
 *
 * Both modules are dependency-free so this test imports them without
 * pulling in env-gated server modules. If these tests fail, a price change
 * was made in one place but not the other — fix the configs, never the test.
 */
describe('Pricing single source of truth', () => {
  test('every server plan has exactly one matching display plan', () => {
    const serverIds = Object.keys(PRO_PLANS).sort();
    const displayIds = PRO_PLAN_LIST.map((p) => p.id).sort();
    assert.deepStrictEqual(displayIds, serverIds, 'plan id sets must match');
  });

  test('display price / days / label match the charged values', () => {
    const server = PRO_PLANS as Record<string, { amountPaise: number; validityDays: number; label: string }>;
    for (const p of PRO_PLAN_LIST) {
      const s = server[p.id];
      assert.ok(s, `server plan missing for display plan ${p.id}`);
      assert.strictEqual(p.price, s.amountPaise / 100, `${p.id}: display ₹${p.price} != charged ₹${s.amountPaise / 100}`);
      assert.strictEqual(p.days, s.validityDays, `${p.id}: display ${p.days}d != charged ${s.validityDays}d`);
      assert.strictEqual(p.label, s.label, `${p.id}: label drift`);
    }
  });

  test('no hardcoded plan prices in components (must read from the catalogue)', () => {
    // ₹ amounts that are plan prices. Components must use getPlanDisplay() /
    // getLowestPlanPrice() / PRO_PLAN_LIST instead of literals.
    const priceRe = /₹(59|199|499|999|1799)\b/;
    const allowedOnLine = /getLowestPlanPrice|monthlyPlan|plan\.price|[^a-zA-Z]p\.price/;
    const roots = [path.join(process.cwd(), 'src', 'components'), path.join(process.cwd(), 'src', 'utils')];
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(tsx?)$/.test(entry.name)) continue;
        if (full.endsWith('config/plans.ts')) continue; // the source of truth itself
        const lines = fs.readFileSync(full, 'utf8').split('\n');
        lines.forEach((line, i) => {
          const code = line.replace(/\/\/.*$/, ''); // strip line comments
          if (code.includes('SAMPLE')) return; // sample/demo data, not plan pricing
          if (priceRe.test(code) && !allowedOnLine.test(code)) {
            offenders.push(`${path.relative(process.cwd(), full)}:${i + 1}: ${line.trim().slice(0, 90)}`);
          }
        });
      }
    };
    roots.forEach(walk);
    assert.strictEqual(
      offenders.length,
      0,
      `hardcoded plan prices found — read them from src/config/plans.ts instead:\n${offenders.join('\n')}`
    );
  });
});
