/**
 * Downloads Twemoji PNG assets for every emoji used in movies.ts
 * into src/client/public/emoji/ so the client can serve them same-origin.
 * Run from repo root: node scripts/download-twemoji.mjs
 *
 * Twemoji graphics © Twitter, CC-BY 4.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const moviesPath = path.join(repoRoot, 'src/shared/data/movies.ts');
const outDir = path.join(repoRoot, 'src/client/public/emoji');

const TWEMOJI_CDN = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72';

/** Only strings that contain at least one character in emoji/symbol ranges (excludes "WALL·E" etc.). */
function isEmoji(s) {
  const t = s.trim();
  if (!t || t.length > 20) return false;
  return [...t].some((c) => {
    const cp = c.codePointAt(0) ?? 0;
    return (
      (cp >= 0x1f300 && cp <= 0x1f9ff) ||
      (cp >= 0x2600 && cp <= 0x27bf) ||
      (cp >= 0x1f1e6 && cp <= 0x1f1ff) ||
      (cp >= 0x2300 && cp <= 0x23ff) ||
      (cp >= 0x2b50 && cp <= 0x2b55) ||
      (cp >= 0x1f600 && cp <= 0x1f64f) ||
      (cp >= 0x1f900 && cp <= 0x1f9ff)
    );
  });
}

function toCodePoint(emoji) {
  return Array.from(emoji)
    .map((c) => (c.codePointAt(0) ?? 0).toString(16))
    .join('-');
}

/** Split string into grapheme clusters (so '🧍‍♂️🧍‍♂️' → ['🧍‍♂️', '🧍‍♂️']). */
function splitGraphemes(str) {
  if (typeof Intl.Segmenter !== 'undefined') {
    return [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(str)].map((s) => s.segment);
  }
  return [...str];
}

function extractEmojisFromMovies(content) {
  const list = new Set();
  // Match emojis: ['x','y'] }, or emojis: ['x','y'] ] at end
  const arrayBlocks = content.matchAll(/emojis: \[([\s\S]*?)\]\s*[,\}\]]/g);
  for (const [, block] of arrayBlocks) {
    // Match both double- and single-quoted strings
    const quoted = block.matchAll(/(?:"([^"]*)"|'([^']*)')/g);
    for (const [, d, s] of quoted) {
      const str = (d ?? s ?? '').trim();
      if (!str) continue;
      for (const part of splitGraphemes(str)) {
        if (isEmoji(part)) list.add(part);
      }
    }
  }
  return [...list];
}

/** Twemoji assets use base codepoint without trailing -fe0f (e.g. 2764.png for ❤️). */
function twemojiIcon(icon) {
  return icon.replace(/-fe0f$/, '');
}

async function downloadEmoji(icon) {
  const normalized = twemojiIcon(icon);
  const urls = [`${TWEMOJI_CDN}/${normalized}.png`, `${TWEMOJI_CDN}/${icon}.png`];
  for (const url of urls) {
    const res = await fetch(url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }
  throw new Error(`404 for ${icon}`);
}

// Emoji used in UI (splash, buttons, game over) — only symbols that exist in Twemoji
const UI_EMOJI = ['🎬', '👋', '🛠️', '☀️', '🌙', '↗️', '🔊', '🔇', '📊', '💀', '✅', '📋'];

async function main() {
  const content = fs.readFileSync(moviesPath, 'utf8');
  const movieEmojis = extractEmojisFromMovies(content);
  const emojis = [...new Set([...movieEmojis, ...UI_EMOJI])];
  console.log(
    `Found ${movieEmojis.length} emoji in movies + ${UI_EMOJI.length} UI → ${emojis.length} unique`
  );

  fs.mkdirSync(outDir, { recursive: true });

  let ok = 0;
  let fail = 0;
  for (const emoji of emojis) {
    const icon = toCodePoint(emoji.trim());
    if (!icon) continue;
    const fileId = twemojiIcon(icon);
    const filePath = path.join(outDir, `${fileId}.png`);
    if (fs.existsSync(filePath)) {
      ok++;
      continue;
    }
    try {
      const buf = await downloadEmoji(icon);
      fs.writeFileSync(filePath, buf);
      ok++;
    } catch (e) {
      console.error(`Failed ${emoji} (${icon}):`, e.message);
      fail++;
    }
  }
  console.log(`Done: ${ok} ok, ${fail} failed. Assets in ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
