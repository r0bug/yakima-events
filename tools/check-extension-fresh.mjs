#!/usr/bin/env node
/**
 * Guard: static/extension.zip is what /extension hands people, and it is a build
 * artifact with nothing tying it to extension/. It silently went 4 days stale once
 * (Mar 27 zip vs Mar 31 content-facebook.js), shipping an older Facebook scraper than
 * the repo. This fails the build when the two diverge.
 *
 * Compares CRC32 + size of every file, NOT mtimes: git does not preserve mtimes, so a
 * fresh clone or checkout would make an mtime comparison fire at random.
 *
 * Run `python3 tools/pack-extension.py` to regenerate the archives.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'extension');
const ZIP = join(ROOT, 'static', 'extension.zip');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(relative(base, full).split(sep).join('/'));
  }
  return out;
}

/** Read the zip's central directory: name -> {crc, size}. */
function readZipIndex(path) {
  const buf = readFileSync(path);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip (no end-of-central-directory): ' + path);

  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const index = new Map();

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('bad central directory entry');
    const crc = buf.readUInt32LE(off + 16);
    const size = buf.readUInt32LE(off + 24);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    if (!name.endsWith('/')) index.set(name, { crc, size });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return index;
}

function fail(lines) {
  console.error('\n  extension.zip is out of date with extension/\n');
  for (const l of lines) console.error('    ' + l);
  console.error('\n  Regenerate:  python3 tools/pack-extension.py\n');
  process.exit(1);
}

if (!existsSync(SRC)) process.exit(0); // nothing to guard
if (!existsSync(ZIP)) fail(['static/extension.zip is missing entirely']);

const zipIndex = readZipIndex(ZIP);
const sourceFiles = walk(SRC);
const problems = [];

for (const rel of sourceFiles) {
  const entry = zipIndex.get(rel);
  if (!entry) { problems.push(`${rel} is in extension/ but not in the zip`); continue; }
  const buf = readFileSync(join(SRC, rel));
  if (entry.size !== buf.length || entry.crc !== crc32(buf)) {
    problems.push(`${rel} differs (zip ${entry.size}B vs source ${buf.length}B)`);
  }
  zipIndex.delete(rel);
}
for (const stale of zipIndex.keys()) problems.push(`${stale} is in the zip but no longer in extension/`);

if (problems.length) fail(problems);
console.log('extension.zip matches extension/ (%d files)', sourceFiles.length);
