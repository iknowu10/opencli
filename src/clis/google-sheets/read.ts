import { CliError } from '../../errors.js';
import { cli, Strategy } from '../../registry.js';
import { ensureGoogleSession, googleFetch, parseSheetId, parseCsv } from './utils.js';

cli({
  site: 'google-sheets',
  name: 'read',
  access: 'read',
  description: 'Read Google Sheet data as table (requires Chrome login)',
  domain: 'docs.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'sheet-id', positional: true, required: true, help: 'Spreadsheet ID or full URL' },
    { name: 'range', default: '', help: 'Cell range, e.g. A1:D10 (default: all data)' },
    { name: 'limit', type: 'int', default: 100, help: 'Max rows' },
  ],
  func: async (page, args) => {
    const sheetId = parseSheetId(String(args['sheet-id']));
    const limit = Math.max(1, Math.min(Number(args.limit), 1000));
    const range = String(args.range || '');

    // Get cookies from browser
    const cookies = await ensureGoogleSession(page);

    // Export as CSV via gviz endpoint
    let exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
    if (range) exportUrl += `&range=${encodeURIComponent(range)}`;

    const resp = await googleFetch(exportUrl, cookies);
    if (!resp.ok) {
      throw new CliError('FETCH_ERROR', `Google Sheets API returned ${resp.status}`, 'Check the sheet ID and your access');
    }

    const csv = await resp.text();
    if (!csv.trim()) throw new CliError('EMPTY_RESULT', 'Sheet is empty');

    const rows = parseCsv(csv);
    if (!rows.length) throw new CliError('EMPTY_RESULT', 'Sheet is empty');

    // Use first row as headers
    const headers = rows[0];
    const data = rows.slice(1, limit + 1).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h || `col${i}`] = row[i] ?? ''; });
      return obj;
    });

    return data;
  },
});
