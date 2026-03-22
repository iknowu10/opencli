/**
 * Productboard shared helpers.
 *
 * Because Productboard has strict CSP that blocks eval(),
 * we can't use page.evaluate(). Instead we:
 * 1. Extract cookies via the Chrome Extension cookies API
 * 2. Make API calls from Node.js with those cookies
 */

import { CliError } from '../../errors.js';
import { sendCommand } from '../../browser/daemon-client.js';

const DOMAIN = 'ignitionapp.productboard.com';
const BASE = `https://${DOMAIN}`;

/** Get Productboard cookies from Chrome via the daemon. */
export async function getCookies(): Promise<string> {
  const cookies = await sendCommand('cookies', { domain: 'productboard.com' }) as Array<{ name: string; value: string }>;
  if (!cookies || cookies.length === 0) {
    throw new CliError('AUTH_REQUIRED', 'No Productboard cookies found', 'Please log in to Productboard in Chrome first');
  }
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

/** Fetch a Productboard API endpoint using extracted cookies. */
export async function pbFetch(path: string, options?: {
  method?: string;
  body?: any;
  params?: Record<string, string>;
  timeout?: number;
}): Promise<any> {
  const url = new URL(`${BASE}${path}`);
  if (options?.params) {
    for (const [k, v] of Object.entries(options.params)) url.searchParams.set(k, v);
  }

  const cookieHeader = await getCookies();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeout ?? 30000);

  try {
    const res = await fetch(url.toString(), {
      method: options?.method || 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.status === 401 || res.status === 403) {
      throw new CliError('AUTH_REQUIRED', `HTTP ${res.status}`, 'Please log in to Productboard in Chrome first');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new CliError('FETCH_ERROR', `HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    return await res.json();
  } catch (e: any) {
    clearTimeout(timer);
    if (e instanceof CliError) throw e;
    if (e.name === 'AbortError') {
      throw new CliError('TIMEOUT', `Request to ${path} timed out`);
    }
    throw e;
  }
}
