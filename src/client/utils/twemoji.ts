/**
 * Converts a single emoji (including ZWJ sequences and flags) to Twemoji codepoint string.
 * e.g. "🇺🇸" → "1f1fa-1f1f8", "👨‍⚖️" → "1f468-200d-2696-fe0f"
 */
function toCodePoint(emoji: string): string {
  return Array.from(emoji)
    .map((c) => (c.codePointAt(0) ?? 0).toString(16))
    .join('-');
}

/** Twemoji asset filenames omit trailing -fe0f (e.g. 2764.png for ❤️). Same as in scripts/download-twemoji.mjs */
function twemojiIcon(icon: string): string {
  return icon.replace(/-fe0f$/, '');
}

/**
 * Returns URL for Twemoji image (assets in public/emoji/). Resolved relative to current document
 * so it works in Reddit webview where absolute paths like /emoji/ may point at the wrong origin.
 * Graphics © Twitter, licensed under CC-BY 4.0.
 */
export function getTwemojiUrl(emoji: string): string {
  const icon = toCodePoint(emoji.trim());
  if (!icon) return '';
  const path = `emoji/${twemojiIcon(icon)}.png`;
  if (typeof document !== 'undefined' && document.baseURI) {
    return new URL(path, document.baseURI).href;
  }
  return `/${path}`;
}

/** Preload Twemoji images; resolves when all are loaded (or after timeout). Game screen should await this so emoji show instantly. */
export function preloadTwemoji(emoji: string[]): Promise<void> {
  const urls = emoji.map(getTwemojiUrl).filter((u): u is string => Boolean(u));
  if (urls.length === 0) return Promise.resolve();
  return Promise.race([
    Promise.all(
      urls.map(
        (url) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = url;
          })
      )
    ),
    new Promise<void>((resolve) => setTimeout(resolve, 3000)),
  ]).then(() => undefined);
}

/** UI emoji used in splash/buttons — preload on app mount. */
export const UI_EMOJI = ['🎬', '👋', '🛠️', '☀️', '🌙', '↗️', '🔊', '🔇', '📊', '💀', '✅', '📋'];
