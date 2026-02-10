/**
 * Resolves a path to a static asset (public/) relative to the current document.
 * Use for images, sounds, etc. so they work in Reddit webview where absolute paths
 * like /snoo.png may point at the wrong origin.
 */
export function getAssetUrl(path: string): string {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  if (typeof document !== 'undefined' && document.baseURI) {
    return new URL(normalized, document.baseURI).href;
  }
  return `/${normalized}`;
}
