import { CliError } from '../../errors.js';
import { cli, Strategy } from '../../registry.js';
import { ensureGoogleSession, googleFetch } from './utils.js';

interface DriveFile {
  id: string;
  title: string;
  modifiedDate: string;
  ownerNames?: string[];
  alternateLink?: string;
}

cli({
  site: 'google-docs',
  name: 'search',
  access: 'read',
  description: 'Search Google Docs by keyword (requires Chrome login)',
  domain: 'docs.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'query', positional: true, required: true, help: 'Search keyword' },
    { name: 'limit', type: 'int', default: 20, help: 'Max results' },
  ],
  columns: ['title', 'modified', 'owner', 'url'],
  func: async (page, args) => {
    const limit = Math.max(1, Math.min(Number(args.limit), 100));
    const keyword = String(args.query).replace(/'/g, "\\'");
    const cookies = await ensureGoogleSession(page);

    const q = encodeURIComponent(
      `fullText contains '${keyword}' and mimeType='application/vnd.google-apps.document' and trashed=false`,
    );
    const url = `https://www.googleapis.com/drive/v2/files?q=${q}&orderBy=modifiedDate desc&maxResults=${limit}&fields=items(id,title,modifiedDate,ownerNames,alternateLink)`;

    const resp = await googleFetch(url, cookies);
    if (!resp.ok) {
      throw new CliError('FETCH_ERROR', `Drive API returned ${resp.status}`, 'Make sure you are logged in to Google');
    }

    const data = await resp.json() as { items?: DriveFile[] };
    const files = data.items ?? [];

    if (!files.length) throw new CliError('NOT_FOUND', 'No docs found', 'Try a different keyword');

    return files.map((f) => ({
      title: f.title,
      modified: f.modifiedDate?.slice(0, 10) ?? '',
      owner: f.ownerNames?.[0] ?? '',
      url: f.alternateLink || `https://docs.google.com/document/d/${f.id}/edit`,
    }));
  },
});
