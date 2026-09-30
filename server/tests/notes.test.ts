import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateNoteInput, NOTE_LIMITS } from '../database/notesDao.js';

describe('validateNoteInput', () => {
  it('accepts a plain personal note', () => {
    const r = validateNoteInput({ text: 'Buy the dip thesis' });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.note.text, 'Buy the dip thesis');
      assert.equal(r.note.icon, 0);
      assert.deepEqual(r.note.tags, []);
      assert.equal(r.note.link, null);
    }
  });

  it('rejects empty / whitespace text', () => {
    assert.equal(validateNoteInput({ text: '   ' }).ok, false);
    assert.equal((validateNoteInput({ text: '' }) as any).error, 'text_required');
  });

  it('rejects over-long text', () => {
    const r = validateNoteInput({ text: 'x'.repeat(NOTE_LIMITS.maxTextLen + 1) }) as any;
    assert.equal(r.ok, false);
    assert.equal(r.error, 'text_too_long');
  });

  it('rejects bad icon indexes', () => {
    assert.equal((validateNoteInput({ text: 'a', icon: -1 }) as any).error, 'bad_icon');
    assert.equal((validateNoteInput({ text: 'a', icon: NOTE_LIMITS.maxIcons }) as any).error, 'bad_icon');
    assert.equal((validateNoteInput({ text: 'a', icon: 1.5 }) as any).error, 'bad_icon');
  });

  it('accepts a valid icon index', () => {
    const r = validateNoteInput({ text: 'a', icon: 5 });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.note.icon, 5);
  });

  it('normalizes tags: strips #, lowercases, dedupes, caps length and count', () => {
    const r = validateNoteInput({
      text: 'a',
      tags: ['#Daily', 'daily', '  Q2  ', 'x'.repeat(100)],
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.deepEqual(r.note.tags, ['daily', 'q2', 'x'.repeat(NOTE_LIMITS.maxTagLen)]);
    }
  });

  it('caps tag count at maxTags', () => {
    const r = validateNoteInput({ text: 'a', tags: ['a','b','c','d','e','f','g','h','i','j'] });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.note.tags.length, NOTE_LIMITS.maxTags);
  });

  it('accepts a stock link with symbol', () => {
    const r = validateNoteInput({
      text: 'a',
      link: { type: 'stock', label: 'RELIANCE', symbol: 'reliance' },
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.note.link!.type, 'stock');
      assert.equal(r.note.link!.symbol, 'RELIANCE');
    }
  });

  it('accepts a news link with https url, rejects javascript: urls', () => {
    const ok = validateNoteInput({
      text: 'a',
      link: { type: 'news', label: 'RBI policy', url: 'https://example.com/x' },
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.note.link!.url, 'https://example.com/x');

    const bad = validateNoteInput({
      text: 'a',
      link: { type: 'news', label: 'RBI policy', url: 'javascript:alert(1)' },
    });
    assert.equal(bad.ok, true);
    if (bad.ok) assert.equal(bad.note.link!.url, undefined);
  });

  it('rejects malformed links', () => {
    assert.equal((validateNoteInput({ text: 'a', link: { type: 'bogus', label: 'x' } } as any) as any).error, 'bad_link');
    assert.equal((validateNoteInput({ text: 'a', link: { type: 'stock', label: '  ' } } as any) as any).error, 'bad_link');
    assert.equal((validateNoteInput({ text: 'a', link: null as any }) as any).ok, true);
  });

  it('accepts a filing link with a pdf url', () => {
    const r = validateNoteInput({
      text: 'a',
      link: { type: 'filing', label: 'RELIANCE · Board meeting outcome', symbol: 'RELIANCE', url: 'https://www.bseindia.com/xml-data/corpfiling/AttachHis/abc.pdf' },
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.note.link!.type, 'filing');
      assert.ok(r.note.link!.url!.startsWith('https://'));
    }
  });

  it('trims an over-long label', () => {
    const r = validateNoteInput({ text: 'a', link: { type: 'result', label: 'x'.repeat(500) } });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.note.link!.label.length, NOTE_LIMITS.maxLabelLen);
  });
});
