import { test, describe } from 'node:test';
import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';

// Simple mock for testing without touching the main DB
describe('Duplicate Detection & Watchlist Tests', () => {
  test('Watchlist symbols should be uppercase and trimmed', () => {
    const rawInput = ' tcs , INfy, rELianCE ';
    const parsed = rawInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    assert.deepEqual(parsed, ['TCS', 'INFY', 'RELIANCE']);
  });

  test('Database unique constraints prevent duplicate announcements', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT,
        subject TEXT,
        pdf_link TEXT UNIQUE,
        details TEXT,
        category TEXT,
        is_sent INTEGER DEFAULT 0,
        fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    const stmt = db.prepare('INSERT INTO announcements (company_name, subject, pdf_link, category) VALUES (?, ?, ?, ?)');
    stmt.run('TCS', 'Test subject', 'https://example.com/1', 'FILTERED');
    
    let errorThrown = false;
    try {
      stmt.run('TCS', 'Test subject 2', 'https://example.com/1', 'FILTERED');
    } catch (e) {
      errorThrown = true;
    }
    
    assert.strictEqual(errorThrown, true, 'Should throw unique constraint error for duplicate pdf_link');
  });
});
