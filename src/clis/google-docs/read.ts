import { CliError } from '../../errors.js';
import { cli, Strategy } from '../../registry.js';
import { ensureGoogleSession, googleFetch, parseDocId } from './utils.js';

cli({
  site: 'google-docs',
  name: 'read',
  access: 'read',
  description: 'Read a Google Doc as plain text (requires Chrome login)',
  domain: 'docs.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'doc-id', positional: true, required: true, help: 'Document ID or full URL' },
    { name: 'max-length', type: 'int', default: 5000, help: 'Max output characters' },
  ],
  columns: ['title', 'content'],
  func: async (page, args) => {
    const docId = parseDocId(String(args['doc-id']));
    const maxLen = Number(args['max-length']) || 5000;

    const cookies = await ensureGoogleSession(page);

    // Export as plain text
    const resp = await googleFetch(
      `https://docs.google.com/document/d/${docId}/export?format=txt`,
      cookies,
    );
    if (!resp.ok) {
      throw new CliError('FETCH_ERROR', `Export returned ${resp.status}`, 'Check the doc ID and your access');
    }

    const text = await resp.text();
    const content = text.slice(0, maxLen);

    // Get title from the HTML page
    const htmlResp = await googleFetch(
      `https://docs.google.com/document/d/${docId}/edit`,
      cookies,
    );
    let title = 'Untitled';
    if (htmlResp.ok) {
      const html = await htmlResp.text();
      const m = html.match(/<title>([^<]+)<\/title>/);
      if (m) title = m[1].replace(/ - Google Docs$/, '').trim();
    }

    return [{ title, content }];
  },
});
