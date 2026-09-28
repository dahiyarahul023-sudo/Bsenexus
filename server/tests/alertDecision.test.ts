import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  doesAnnouncementMatchUserPrefs,
  isTelegramEligible,
  wantsTelegramEnable
} from '../utils/alertDecision.js';

/**
 * Alert-decision contract (the alert-system bugfix batch, 28 Sep 2026):
 *  1. Master telegramAlertsEnabled toggle is a kill-switch.
 *  2. Telegram fires only on telegram-ELIGIBLE matches (own rules or a rule
 *     whose telegram channel is ON). In-app-only rule matches must never
 *     produce a Telegram message.
 *  3. Missing prefs fail CLOSED (WATCHLIST_ONLY), never match-everything.
 *  4. The Pro gate (wantsTelegramEnable) only guards ENABLING — turning
 *     alerts OFF is always allowed.
 */

const HIGH_RESULTS = { level: 'HIGH', category: 'RESULTS' };
const HIGH_GENERAL = { level: 'HIGH', category: 'GENERAL' };

describe('doesAnnouncementMatchUserPrefs', () => {
  test('missing prefs fail closed: non-watchlist announcement does not match', () => {
    assert.strictEqual(
      doesAnnouncementMatchUserPrefs(undefined, HIGH_RESULTS, 'HIGH', 'Q2 Results', 'profit up', false),
      false
    );
    assert.strictEqual(
      doesAnnouncementMatchUserPrefs(null, HIGH_RESULTS, 'HIGH', 'Q2 Results', 'profit up', false),
      false
    );
    assert.strictEqual(
      doesAnnouncementMatchUserPrefs({}, HIGH_RESULTS, 'HIGH', 'Q2 Results', 'profit up', false),
      false
    );
  });

  test('missing prefs still match a watchlist stock announcement', () => {
    assert.strictEqual(
      doesAnnouncementMatchUserPrefs(undefined, HIGH_RESULTS, 'HIGH', 'Q2 Results', 'profit up', true),
      true
    );
  });

  test('explicit WATCHLIST_ONLY scope blocks non-watchlist announcements', () => {
    const prefs = { telegramAlertScope: 'WATCHLIST_ONLY' };
    assert.strictEqual(doesAnnouncementMatchUserPrefs(prefs, HIGH_RESULTS, 'HIGH', 's', 'd', false), false);
    assert.strictEqual(doesAnnouncementMatchUserPrefs(prefs, HIGH_RESULTS, 'HIGH', 's', 'd', true), true);
  });

  test('ALL_MARKET scope allows non-watchlist announcements', () => {
    const prefs = { telegramAlertScope: 'ALL_MARKET' };
    assert.strictEqual(doesAnnouncementMatchUserPrefs(prefs, HIGH_RESULTS, 'HIGH', 's', 'd', false), true);
  });

  test('LOW priority watchlist stocks are muted by default', () => {
    assert.strictEqual(
      doesAnnouncementMatchUserPrefs({}, HIGH_GENERAL, 'LOW', 's', 'd', true),
      false
    );
    assert.strictEqual(
      doesAnnouncementMatchUserPrefs({ stocksLowPriority: true }, HIGH_GENERAL, 'LOW', 's', 'd', true),
      true
    );
  });
});

describe('isTelegramEligible', () => {
  test('in-app-only rule match is NOT telegram-eligible', () => {
    // The system buyback preset: ALL_STOCKS scope, telegram channel OFF.
    // prefsMatch=false (not in watchlist), ruleShouldSendTelegram=false.
    assert.strictEqual(isTelegramEligible(false, false), false);
  });

  test('own filter match is telegram-eligible', () => {
    assert.strictEqual(isTelegramEligible(true, false), true);
  });

  test('rule with telegram channel ON is telegram-eligible', () => {
    assert.strictEqual(isTelegramEligible(false, true), true);
  });
});

describe('wantsTelegramEnable (Pro gate)', () => {
  test('turning alerts OFF is never gated', () => {
    const existing = { notificationPreferences: { telegramAlertsEnabled: true } };
    assert.strictEqual(wantsTelegramEnable({ telegramAlertsEnabled: false }, existing), false);
  });

  test('turning alerts ON from off is gated', () => {
    const existing = { notificationPreferences: { telegramAlertsEnabled: false } };
    assert.strictEqual(wantsTelegramEnable({ telegramAlertsEnabled: true }, existing), true);
  });

  test('leaving alerts ON (no change) is not gated', () => {
    const existing = { notificationPreferences: { telegramAlertsEnabled: true } };
    assert.strictEqual(wantsTelegramEnable({ telegramAlertsEnabled: true }, existing), false);
  });

  test('linking a chat id is gated', () => {
    assert.strictEqual(wantsTelegramEnable({ telegramChatId: '12345' }, {}), true);
  });

  test('unlinking (null chat id) is not gated', () => {
    assert.strictEqual(wantsTelegramEnable({ telegramChatId: null }, {}), false);
  });

  test('enabling news alerts is gated, disabling is not', () => {
    const existing = { notificationPreferences: { telegramNewsAlerts: false } };
    assert.strictEqual(wantsTelegramEnable({ telegramNewsAlerts: true }, existing), true);
    assert.strictEqual(
      wantsTelegramEnable({ telegramNewsAlerts: false }, { notificationPreferences: { telegramNewsAlerts: true } }),
      false
    );
  });
});
