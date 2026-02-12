const STORAGE_KEY = 'kinoticon-session-id';

/** Persistent session ID for anonymous users. Server-issued; store from X-Session-Id response header. */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

/** Store session ID from server response (called after fetch to /api/*). */
export function storeSessionIdFromResponse(res: Response): void {
  const id = res.headers.get('X-Session-Id');
  if (id && typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, id);
  }
}
