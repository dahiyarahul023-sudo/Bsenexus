import { test, describe } from 'node:test';
import assert from 'node:assert';
import { cleanBseSubject, detectHumanTitle } from '../../src/utils/cleanBseSubject';
import { getSafePdfUrl } from '../../src/utils/pdfHelper';

describe('BSE Subject Cleaning & PDF Helper Tests', () => {
  test('cleanBseSubject handles undefined or null gracefully without crashing', () => {
    const res1 = cleanBseSubject(undefined);
    assert.strictEqual(res1.headline, 'Corporate Announcement');
    assert.strictEqual(res1.humanTitle, 'Corporate announcement');

    const res2 = cleanBseSubject(null);
    assert.strictEqual(res2.headline, 'Corporate Announcement');

    const res3 = cleanBseSubject('');
    assert.strictEqual(res3.headline, 'Corporate Announcement');
  });

  test('cleanBseSubject strips duplicate company name and Regulation 30 boilerplate', () => {
    const raw = 'Tata Motors Ltd - Announcement under Regulation 30 (LODR)-Press Release';
    const res = cleanBseSubject(raw, 'Tata Motors Ltd', 500570);
    assert.ok(!res.headline.includes('Announcement under Regulation 30'));
    assert.strictEqual(res.humanTitle, 'Press release');
  });

  test('detectHumanTitle detects financial results, orders, and leadership changes', () => {
    assert.strictEqual(detectHumanTitle('Audited Financial Results For The Quarter Ended June 30, 2024'), 'Financial results');
    assert.strictEqual(detectHumanTitle('Company has bagged an order worth Rs 500 Cr'), 'Commercial order');
    assert.strictEqual(detectHumanTitle('Resignation of Chief Financial Officer'), 'Leadership update');
    assert.strictEqual(detectHumanTitle('Recommendation of Final Dividend of Rs 5 per share'), 'Corporate action');
  });

  test('getSafePdfUrl constructs correct proxy URL with parameters', () => {
    const safeUrl = getSafePdfUrl('https://www.bseindia.com/xml-data/corpfiling/AttachLive/abc.pdf', 'abc.pdf', '12345', '500570');
    assert.ok(safeUrl.startsWith('/api/pdf-open?'));
    assert.ok(safeUrl.includes('file=abc.pdf'));
    assert.ok(safeUrl.includes('newsId=12345'));
    assert.ok(safeUrl.includes('scrip=500570'));
  });

  test('getSafePdfUrl falls back to corporate announcements page when no link or attachment', () => {
    const safeUrl = getSafePdfUrl(undefined, null, undefined);
    assert.strictEqual(safeUrl, 'https://www.bseindia.com/corporates/ann.html');
  });
});
