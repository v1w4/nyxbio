import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sanitize, THEMES, saveProfile, getProfile } from '../src/db.js';
import { Model, __version__ } from '../src/model.js';
import { DEFAULT_CORPUS, Tokenizer } from '../src/language.js';

test('THEMES está completa', () => {
  assert.equal(THEMES.length, 10);
  assert.ok(THEMES.includes('custom'));
});

test('sanitize rejeita URL malformada', () => {
  const p = sanitize({ links: [{ label: 'ok', url: 'not-a-url' }] });
  assert.equal(p.links.length, 0);
});

test('sanitize valida hex', () => {
  const p = sanitize({ customTheme: { bg: '#fff', accent: 'nope', text: '#0000ff' } });
  assert.ok(p.customTheme.bg);
  assert.equal(p.customTheme.accent, '');
  assert.equal(p.customTheme.text, '#0000ff');
});

test('sanitize limita tamanhos', () => {
  const p = sanitize({ name: 'A'.repeat(100), bio: 'B'.repeat(500) });
  assert.equal(p.name.length, 40);
  assert.equal(p.bio.length, 160);
});

test('Model tem versão exportada', () => {
  assert.ok(__version__);
});

test('Tokenizer encode/decode arredonda', () => {
  const t = new Tokenizer();
  t.build('olá mundo ');
  const ids = t.encode('olá');
  const txt = t.display(ids);
  assert.equal(txt, 'olá');
});

test('Corpus tem frases', () => {
  assert.ok(Array.isArray(DEFAULT_CORPUS));
  assert.ok(DEFAULT_CORPUS.length > 20);
});

test('Model gera algo não-vazio', () => {
  const m = new Model(DEFAULT_CORPUS, { d: 32, nLayers: 2, nHeads: 4, temperature: 0.8, maxTokens: 8 });
  const go = m.generate('nyx', { maxTokens: 8 });
  const buf = [];
  for (const t of go) buf.push(t);
  assert.ok(buf.length > 0);
});
