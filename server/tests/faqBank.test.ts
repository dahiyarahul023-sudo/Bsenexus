import { test, describe } from 'node:test';
import assert from 'node:assert';
import { findBankAnswer, faqBankSize, FAQ_BANK } from '../services/faqBank.js';

/**
 * FAQ bank matcher tests.
 * The bank is Layer 1 of the abuse defence: matched questions cost zero
 * Gemini API calls. These tests pin the matcher's behaviour so a bad
 * threshold change can't silently start burning AI quota (or vice versa —
 * can't start answering with the wrong canned answer).
 */
describe('FAQ bank', () => {
  test('bank holds at least 40 curated entries', () => {
    assert.ok(faqBankSize() >= 40, `expected >= 40, got ${faqBankSize()}`);
    assert.strictEqual(FAQ_BANK.length, faqBankSize());
  });

  test('every entry has id, keywords, phrases and a non-empty answer', () => {
    const ids = new Set<string>();
    for (const e of FAQ_BANK) {
      assert.ok(e.id && e.id.length > 2, 'entry missing id');
      assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
      ids.add(e.id);
      assert.ok(e.keywords.length >= 2, `${e.id}: needs >= 2 keywords`);
      assert.ok(e.phrases.length >= 1, `${e.id}: needs >= 1 phrase`);
      assert.ok(e.answer.length > 20, `${e.id}: answer too short`);
    }
  });

  const cases: Array<[string, string]> = [
    ['How much does Pro cost?', 'pro-cost'],
    ['What is the monthly price?', 'monthly-price'],
    ['weekly plan kitna hai', 'weekly-price'],
    ['Tell me the yearly plan cost', 'yearly-price'],
    ['6 month plan price?', 'halfyearly-price'],
    ['Which is the cheapest plan?', 'cheapest-plan'],
    ['Which plan should I take?', 'best-value'],
    ['Any discount coupons?', 'discount'],
    ['Can I pay with UPI?', 'payment-methods'],
    ['Is it a subscription? Will I be charged monthly?', 'one-time'],
    ['What is the refund policy?', 'refund'],
    ['Is there a free plan?', 'free-tier'],
    ['How long is the free trial?', 'trial-length'],
    ['Do I need a credit card for the trial?', 'trial-card'],
    ['What happens after my trial ends?', 'trial-after'],
    ['How do I start the free trial?', 'trial-start'],
    ['How do I create an account?', 'signup'],
    ['I forgot my password', 'no-password'],
    ['How to create a watchlist?', 'watchlist-create'],
    ['Are watchlists free?', 'watchlist-free'],
    ['How do I link Telegram?', 'telegram-setup'],
    ['What are Telegram alerts?', 'telegram-what'],
    ['Where does the data come from?', 'data-source'],
    ['How many companies are covered?', 'coverage'],
    ['What is BSE Nexus?', 'what-is'],
    ['Are AI summaries in Hindi?', 'ai-language'],
    ['Can I export my watchlist as CSV?', 'export'],
    ['Is BSE Nexus affiliated with BSE?', 'affiliated'],
    ['What happens when my Pro expires?', 'pro-expire'],
    ['How can I contact support?', 'contact-support'],
  ];

  for (const [question, expectedId] of cases) {
    test(`matches "${question}" -> ${expectedId}`, () => {
      const hit = findBankAnswer(question);
      assert.ok(hit, `no bank match for: ${question}`);
      assert.strictEqual(hit.id, expectedId, `wrong entry for "${question}" (got ${hit.id}, score ${hit.score})`);
    });
  }

  const noMatch = [
    'What is the weather in Mumbai today?',
    'Who will win the next cricket match?',
    'xyz abc random nonsense words qwerty',
    'Hi',
  ];
  for (const q of noMatch) {
    test(`does NOT match off-topic "${q}"`, () => {
      assert.strictEqual(findBankAnswer(q), null);
    });
  }
});
