import { CliError } from '../../errors.js';
import { cli, Strategy } from '../../registry.js';
import { ensureGoogleSession, googleFetch, parseDocId } from './utils.js';

cli({
  site: 'google-docs',
  name: 'write',
  description: 'Append text to a Google Doc (requires Chrome login)',
  domain: 'docs.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'doc-id', positional: true, required: true, help: 'Document ID or full URL' },
    { name: 'text', required: true, help: 'Text to append to the document' },
  ],
  columns: ['title', 'status'],
  func: async (page, args) => {
    const docId = parseDocId(String(args['doc-id']));
    const text = String(args.text);

    const cookies = await ensureGoogleSession(page);

    // Get current doc length to know where to insert
    const docResp = await googleFetch(
      `https://docs.googleapis.com/v1/documents/${docId}`,
      cookies,
    );
    if (!docResp.ok) {
      throw new CliError('FETCH_ERROR', `Docs API returned ${docResp.status}`, 'Check the doc ID and your access');
    }

    const doc = await docResp.json() as { title?: string; body?: { content?: { endIndex?: number }[] } };
    const title = doc.title || 'Untitled';

    // Find the end index of the document
    const lastElement = doc.body?.content?.at(-1);
    const endIndex = (lastElement?.endIndex ?? 2) - 1;

    // Insert text at the end
    const updateResp = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        requests: [
          { insertText: { location: { index: endIndex }, text: '\n' + text } },
        ],
      }),
    });

    if (!updateResp.ok) {
      const errText = await updateResp.text();
      throw new CliError('FETCH_ERROR', `Docs update failed (${updateResp.status})`, errText.slice(0, 200));
    }

    return [{ title, status: 'text appended' }];
  },
});
