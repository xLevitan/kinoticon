/**
 * Exports splash images as two logo variants:
 * - Light: cropped, alpha filled with gray-50 (#f9fafb)
 * - Dark: cropped, alpha filled with gray-900 (#111827)
 * Output: dist/downloads/kinoticon-logo-light.png, kinoticon-logo-dark.png
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const publicDir = path.join(repoRoot, 'src/client/public');
const outDir = path.join(repoRoot, 'dist/downloads');

const BG_LIGHT = { r: 249, g: 250, b: 251 }; // Tailwind gray-50
const BG_DARK = { r: 17, g: 24, b: 39 }; // Tailwind gray-900
const ALPHA_THRESHOLD = 5;
/** Design padding as fraction of content size (e.g. 0.12 = 12% on each side) */
const PADDING_RATIO = 0.12;

async function findBoundingBox(data, width, height, channels) {
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * channels + channels - 1];
      if (alpha > ALPHA_THRESHOLD) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  if (left > right) return null;
  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

async function processSplash(inputPath, outputPath, bgColor) {
  const image = sharp(inputPath);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const box = await findBoundingBox(data, width, height, channels);
  if (!box) {
    throw new Error('No content found in image');
  }

  const { width: cw, height: ch } = box;
  const contentMax = Math.max(cw, ch);
  const padding = Math.round(contentMax * PADDING_RATIO);
  const squareSize = contentMax + 2 * padding;

  const padLeft = Math.round((squareSize - cw) / 2);
  const padRight = squareSize - cw - padLeft;
  const padTop = Math.round((squareSize - ch) / 2);
  const padBottom = squareSize - ch - padTop;

  const OUTPUT_SIZE = 500;

  const extracted = await sharp(inputPath)
    .ensureAlpha()
    .extract(box)
    .flatten({ background: bgColor })
    .toBuffer();

  const extended = await sharp(extracted)
    .extend({
      left: padLeft,
      right: padRight,
      top: padTop,
      bottom: padBottom,
      background: bgColor,
    })
    .toBuffer();

  const result = await sharp(extended)
    .resize(OUTPUT_SIZE, OUTPUT_SIZE)
    .png()
    .toFile(outputPath);

  console.log(`  ${path.basename(outputPath)}: ${result.width}x${result.height}`);
}

async function main() {
  const lightIn = path.join(publicDir, 'splash-light.png');
  const darkIn = path.join(publicDir, 'splash-dark.png');

  if (!fs.existsSync(lightIn)) {
    console.error('Not found:', lightIn);
    process.exit(1);
  }
  if (!fs.existsSync(darkIn)) {
    console.error('Not found:', darkIn);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const lightOut = path.join(outDir, 'kinoticon-logo-light.png');
  const darkOut = path.join(outDir, 'kinoticon-logo-dark.png');

  console.log('Processing splash images...');
  await processSplash(lightIn, lightOut, BG_LIGHT);
  await processSplash(darkIn, darkOut, BG_DARK);

  console.log('\nDone! Logos saved to:', outDir);
  console.log('  kinoticon-logo-light.png (bg: gray-50)');
  console.log('  kinoticon-logo-dark.png (bg: gray-900)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
