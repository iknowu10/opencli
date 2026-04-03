/**
 * Google Docs adapter utilities.
 *
 * Uses browser session to extract Google cookies, then makes
 * API requests from Node.js — bypassing CSP restrictions on Google pages.
 */

import type { IPage, BrowserCookie } from '../../types.js';
import { CliError } from '../../errors.js';

/** Get Google cookies from the browser session */
export async function getGoogleCookies(page: IPage): Promise<string> {
  // Use url-based cookie query to include httpOnly cookies
  const cookies = await page.getCookies({ url: 'https://docs.google.com' });
  if (!cookies.length) {
    throw new CliError('AUTH_REQUIRED', 'No Google cookies found', 'Log in to Google in Chrome first');
  }
  return cookies.map((c: BrowserCookie) => `${c.name}=${c.value}`).join('; ');
}

/** Make a fetch request to Google APIs using cookies from the browser */
export async function googleFetch(url: string, cookieStr: string): Promise<Response> {
  // Google export URLs redirect to googleusercontent.com which doesn't need cookies.
  // Handle redirect manually: send cookies on first request, follow redirect without.
  const first = await fetch(url, {
    headers: {
      'Cookie': cookieStr,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
    redirect: 'manual',
  });

  if (first.status === 401 || first.status === 403) {
    throw new CliError('AUTH_REQUIRED', 'Google authentication failed', 'Re-login to Google in Chrome');
  }

  // Follow redirect
  if (first.status >= 300 && first.status < 400) {
    const location = first.headers.get('location');
    if (location) {
      return fetch(location, { redirect: 'follow' });
    }
  }

  return first;
}

/** Get cookies from the browser session (no navigation needed) */
export async function ensureGoogleSession(page: IPage): Promise<string> {
  return getGoogleCookies(page);
}

/** Parse a doc ID from a full URL or return as-is */
export function parseDocId(input: string): string {
  const m = input.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input)) return input;
  throw new CliError('ARGUMENT', 'Invalid document ID', 'Provide a doc ID or Google Docs URL');
}
