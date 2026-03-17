/**
 * Gogs shared helpers.
 * Token: ~/.config/gogs/token or ~/.gogs-token
 * Credentials: hardcoded for gogs.zyuncai.com
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export const GOGS_URL = 'https://gogs.zyuncai.com';
const GOGS_USER = 'jun';
const GOGS_PASS = 'Zhiyunjun';

export function gogsToken(): string {
  for (const p of [join(homedir(), '.config', 'gogs', 'token'), join(homedir(), '.gogs-token')]) {
    try { return readFileSync(p, 'utf8').trim(); } catch {}
  }
  throw new Error('Create ~/.config/gogs/token with your Gogs API token');
}

export async function gogsAPI(path: string, opts: { method?: string; body?: any } = {}): Promise<any> {
  const res = await fetch(`${GOGS_URL}/api/v1${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Authorization': `token ${gogsToken()}`,
      'Content-Type': 'application/json',
    },
    ...(opts.body != null ? { body: JSON.stringify(opts.body) } : {}),
  });
  if (!res.ok) throw new Error(`Gogs API error ${res.status}: ${await res.text()}`);
  return res.json();
}

function collectSetCookies(headers: Headers): string[] {
  try { return (headers as any).getSetCookie() as string[]; } catch {}
  const h = headers.get('set-cookie');
  return h ? h.split(/,(?=[^ ])/) : [];
}

function mergeCookies(existing: Record<string, string>, setCookieHeaders: string[]): Record<string, string> {
  const out = { ...existing };
  for (const header of setCookieHeaders) {
    const [kv] = header.split(';');
    const eq = kv.indexOf('=');
    if (eq < 0) continue;
    const k = kv.slice(0, eq).trim();
    const v = kv.slice(eq + 1).trim();
    out[k] = v;
  }
  return out;
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

/** Login to Gogs and return a cookie jar for subsequent web requests. */
export async function gogsLogin(): Promise<Record<string, string>> {
  // Step 1: get CSRF from login page
  const loginPageRes = await fetch(`${GOGS_URL}/user/login`);
  let jar = mergeCookies({}, collectSetCookies(loginPageRes.headers));
  const html = await loginPageRes.text();
  const csrfMatch = html.match(/name="_csrf"\s+value="([^"]+)"/);
  if (!csrfMatch) throw new Error('Could not find CSRF token on Gogs login page');

  // Step 2: POST login
  const body = new URLSearchParams({ _csrf: csrfMatch[1], user_name: GOGS_USER, password: GOGS_PASS });
  const loginRes = await fetch(`${GOGS_URL}/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookieHeader(jar) },
    body: body.toString(),
    redirect: 'manual',
  });
  jar = mergeCookies(jar, collectSetCookies(loginRes.headers));
  return jar;
}

/** GET a Gogs web page with the given cookie jar. */
export async function gogsWebGet(path: string, jar: Record<string, string>): Promise<string> {
  const res = await fetch(`${GOGS_URL}${path}`, { headers: { 'Cookie': cookieHeader(jar) } });
  return res.text();
}

/** POST a Gogs web form (auto-fetches CSRF). Returns redirect location. */
export async function gogsWebPost(path: string, jar: Record<string, string>, fields: Record<string, string>): Promise<string> {
  const html = await gogsWebGet(path, jar);
  const csrfMatch = html.match(/name="_csrf"\s+value="([^"]+)"/);
  if (!csrfMatch) throw new Error('Could not find CSRF token on page');

  const body = new URLSearchParams({ _csrf: csrfMatch[1], ...fields });
  const res = await fetch(`${GOGS_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookieHeader(jar) },
    body: body.toString(),
    redirect: 'manual',
  });
  return res.headers.get('location') ?? '';
}
