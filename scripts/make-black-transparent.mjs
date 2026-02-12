/**
 * Makes black pixels transparent in a PNG (for alpha channel).
 * Usage: node scripts/make-black-transparent.mjs <input> <output>
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const input = process.argv[2];
const output = process.argv[3];

if (!input) {
  console.error('Usage: node scripts/make-black-transparent.mjs <input> <output>');
  process.exit(1);
}
if (!output) {
  console.error('Output path required (use different path than input to avoid overwrite during read)');
  process.exit(1);
}

const inputPath = path.isAbsolute(input) ? input : path.join(repoRoot, input);
const outputPath = path.isAbsolute(output) ? output : path.join(repoRoot, output);

if (!fs.existsSync(inputPath)) {
  console.error('Input file not found:', inputPath);
  process.exit(1);
}

const BLACK_THRESHOLD = 40; // pixels with r,g,b all < this become transparent

async function main() {
  const image = sharp(inputPath);
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const pixels = data.length / channels;

  for (let i = 0; i < pixels; i++) {
    const offset = i * channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    if (r < BLACK_THRESHOLD && g < BLACK_THRESHOLD && b < BLACK_THRESHOLD) {
      data[offset + channels - 1] = 0; // set alpha to 0
    }
  }

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toFile(outputPath);

  console.log('Done:', outputPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
