import { test, describe } from 'node:test';
import assert from 'node:assert';
import { saveAnnouncementsBatch, getRecentAnnouncements, getAnnouncementById } from '../database/announcementDao.js';
import { addNotificationsBatch, markNotificationsReadBatch, getAllNotifications } from '../database/notificationDao.js';
import { addLogsBatch, getLogs } from '../database/logDao.js';

describe('Batch Inserts and Updates Tests', () => {
  test('saveAnnouncementsBatch inserts new items and skips identical duplicates', async () => {
    const testId1 = `batch_test_${Date.now()}_1`;
    const testId2 = `batch_test_${Date.now()}_2`;

    const items = [
      {
        newsId: testId1,
        companyName: 'TATA CONSULTANCY SERVICES LTD',
        subject: 'Financial Results Q3',
        details: 'Approved quarterly standalone and consolidated results',
        pdfLink: 'https://example.com/tcs.pdf',
        bseTime: new Date().toISOString(),
        priority: 'HIGH',
        category: 'RESULTS',
        scrip_cd: '532540',
        isWatchlist: true
      },
      {
        newsId: testId2,
        companyName: 'INFOSYS LTD',
        subject: 'Press Release - New Strategic Alliance',
        details: 'Infosys expands collaboration in enterprise cloud',
        pdfLink: 'https://example.com/infy.pdf',
        bseTime: new Date().toISOString(),
        priority: 'MEDIUM',
        category: 'COMPANY_UPDATE',
        scrip_cd: '500209',
        isWatchlist: true
      }
    ];

    // First batch run: should insert both
    const res1 = await saveAnnouncementsBatch(items);
    assert.strictEqual(res1.total, 2);
    assert.strictEqual(res1.inserted >= 1, true, 'At least one announcement inserted');

    // Second batch run with exact same data: should skip them
    const res2 = await saveAnnouncementsBatch(items);
    assert.strictEqual(res2.total, 2);
    assert.strictEqual(res2.skipped, 2, 'Both announcements should be skipped as identical');
    assert.strictEqual(res2.inserted, 0, 'No new announcements inserted');
    assert.strictEqual(res2.updated, 0, 'No announcements updated');

    // Verify they are queryable
    const found1 = await getAnnouncementById(testId1);
    const found2 = await getAnnouncementById(testId2);
    assert.ok(found1, 'First announcement present in cache');
    assert.ok(found2, 'Second announcement present in cache');
  });

  test('addNotificationsBatch and markNotificationsReadBatch work correctly', () => {
    const runId = Date.now();
    const notifId1 = `test_notif_${runId}_1`;
    const notifId2 = `test_notif_${runId}_2`;

    const added = addNotificationsBatch([
      {
        id: notifId1,
        title: `TCS Results Alert ${runId}`,
        message: 'Board approved dividend',
        type: 'RESULT',
        priority: 'HIGH',
        symbol: `TCS_${runId}`,
        scripCode: '532540',
        userId: `test_user_${runId}`,
        isWatchlist: true
      },
      {
        id: notifId2,
        title: `INFY Board Meeting Alert ${runId}`,
        message: 'Board meeting scheduled',
        type: 'BOARD_MEETING',
        priority: 'HIGH',
        symbol: `INFY_${runId}`,
        scripCode: '500209',
        userId: `test_user_${runId}`,
        isWatchlist: true
      }
    ]);

    assert.strictEqual(added.length, 2);
    const addedIds = added.map(n => n.id);

    // Mark both as read in batch
    const updatedCount = markNotificationsReadBatch(addedIds, `test_user_${runId}`);
    assert.strictEqual(updatedCount, 2, 'Both notifications marked as read');

    // Re-marking should return 0 updated
    const secondUpdate = markNotificationsReadBatch(addedIds, `test_user_${runId}`);
    assert.strictEqual(secondUpdate, 0, 'Already read notifications should not be updated again');
  });

  test('addLogsBatch inserts log items in bulk without throwing', async () => {
    await addLogsBatch([
      { level: 'INFO', module: 'BATCH_TEST', message: 'Batch logging item 1' },
      { level: 'SUCCESS', module: 'BATCH_TEST', message: 'Batch logging item 2' }
    ]);

    const logs = await getLogs(10);
    const hasBatchLog = logs.some(l => l.module === 'BATCH_TEST');
    assert.strictEqual(hasBatchLog, true, 'Batch log found in logs');
  });
});
