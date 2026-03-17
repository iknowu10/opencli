/**
 * Lattice shared helpers.
 * ~/.lattice-domain — your Lattice subdomain, e.g. mycompany.latticehq.com
 * ~/.lattice-token  — browser cookie string copied from DevTools
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

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

export function latticeCookie(): string {
  return readFile('.lattice-token', 'paste the Cookie header from Lattice DevTools Network tab');
}

export async function latticeGQL(query: string, variables: Record<string, any> = {}): Promise<any> {
  const domain = latticeDomain();
  const cookie = latticeCookie();
  const res = await fetch(`https://${domain}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Lattice API error ${res.status}: ${await res.text()}`);
  return res.json();
}
