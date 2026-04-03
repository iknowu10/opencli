/**
 * Lattice shared helpers.
 * ~/.lattice-domain — your Lattice subdomain, e.g. mycompany.latticehq.com
 *
 * All Lattice commands use browser-based CDP scraping (Strategy.UI).
 * The old GraphQL API (`latticeGQL`) is no longer compatible with Lattice's schema.
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { IPage } from './types.js';

function readFile(name: string, hint: string): string {
  try {
    return readFileSync(join(homedir(), name), 'utf8').trim();
  } catch {
    throw new Error(`Create ~/${name} — ${hint}`);
  }
}

export function latticeDomain(): string {
  return readFile('.lattice-domain', 'your Lattice subdomain (e.g. mycompany.latticehq.com)');
}

/** Navigate to a Lattice page and wait for it to settle */
export async function latticeNavigate(page: IPage, path: string): Promise<void> {
  const domain = latticeDomain();
  await page.goto(`https://${domain}${path}`, { settleMs: 2000 });
}

/** Execute JS in the page and return the result */
export async function latticeEval(page: IPage, js: string): Promise<any> {
  return page.evaluate(js);
}

/** Wait for page content to include specific text */
export async function latticeWaitForText(page: IPage, text: string, timeoutSec = 10): Promise<void> {
  await page.wait({ text, timeout: timeoutSec });
}

/** Get the full inner text of the page body */
export async function latticePageText(page: IPage): Promise<string> {
  return (await page.evaluate('document.body.innerText')) as string;
}

/** Click prev meeting button and wait for content to load */
export async function latticePrevMeeting(page: IPage): Promise<boolean> {
  const result = await page.evaluate(`
    (() => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => (b.getAttribute('aria-label') || '').includes('previous'));
      if (btn) { btn.click(); return true; }
      return false;
    })()
  `);
  if (result) await page.wait(1.5);
  return !!result;
}
