#!/usr/bin/env node
/**
 * scripts/generate-corpus.js
 * Generates a compact training corpus (corpus.txt) from the default
 * lore + a few curated cyberpunk/criminal phrases, used to "warm-start"
 * the local transformer so it doesn't start from complete noise.
 *
 * Run: npm run build:corpus  (creates src/corpus.txt)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CORPUS } from '../src/language.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const out = `
/* AUTO-GENERATED — do not edit by hand. Run: npm run build:corpus */
${DEFAULT_CORPUS.join('\n')}
`;

mkdirSync(`${__dir}/../src`, { recursive: true });
writeFileSync(`${__dir}/../src/corpus.txt`, out);
console.log('corpus.txt gerado com ' + DEFAULT_CORPUS.length + ' frases.');
