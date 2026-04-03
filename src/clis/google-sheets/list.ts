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
  site: 'google-sheets',
  name: 'list',
  description: 'List recent Google Sheets (requires Chrome login)',
  domain: 'docs.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'limit', type: 'int', default: 20, help: 'Max results' },
  ],
  columns: ['title', 'modified', 'owner', 'url'],
  func: async (page, args) => {
    const limit = Math.max(1, Math.min(Number(args.limit), 100));
    const cookies = await ensureGoogleSession(page);

    // Use Google Drive API v2 (works with session cookies)
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const url = `https://www.googleapis.com/drive/v2/files?q=${q}&orderBy=modifiedDate desc&maxResults=${limit}&fields=items(id,title,modifiedDate,ownerNames,alternateLink)`;

    const resp = await googleFetch(url, cookies);
    if (!resp.ok) {
      throw new CliError('FETCH_ERROR', `Drive API returned ${resp.status}`, 'Make sure you are logged in to Google');
    }

    const data = await resp.json() as { items?: DriveFile[] };
    const files = data.items ?? [];

    if (!files.length) throw new CliError('EMPTY_RESULT', 'No spreadsheets found');

    return files.map((f) => ({
      title: f.title,
      modified: f.modifiedDate?.slice(0, 10) ?? '',
      owner: f.ownerNames?.[0] ?? '',
      url: f.alternateLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
    }));
  },
});
