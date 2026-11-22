import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
const tokenBlocks=/(?:^|\n)(?::root,\[data-theme="light"\]|\[data-theme="dark"\])\s*\{[^{}]*\}/g;
const blocks=[...css.matchAll(tokenBlocks)];
assert.equal(blocks.length,2,'Expected the light and dark token blocks');
assert.doesNotMatch(css.replace(tokenBlocks,'').replace(/\/\*[\s\S]*?\*\//g,''),/#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})\b(?![-\w])/i);
console.log('PASS stylesheet hex colours are confined to theme tokens');
