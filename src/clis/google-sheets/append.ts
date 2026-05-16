import { CliError } from '../../errors.js';
import { cli, Strategy } from '../../registry.js';
import { ensureGoogleSession, parseSheetId } from './utils.js';

cli({
  site: 'google-sheets',
  name: 'append',
  access: 'write',
  description: 'Append a row to a Google Sheet (requires Chrome login)',
  domain: 'docs.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'sheet-id', positional: true, required: true, help: 'Spreadsheet ID or full URL' },
    { name: 'values', required: true, help: 'Comma-separated values for the new row, e.g. "Alice,30,Engineering"' },
  ],
  columns: ['range', 'status'],
  func: async (page, args) => {
    const sheetId = parseSheetId(String(args['sheet-id']));
    const values = String(args.values).split(',').map((v) => v.trim());

    const cookies = await ensureGoogleSession(page);

    // Use Sheets API v4 append endpoint
    const range = encodeURIComponent('Sheet1!A1');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      body: JSON.stringify({ values: [values] }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new CliError('FETCH_ERROR', `Sheets API returned ${resp.status}`, errText.slice(0, 200));
    }

    const result = await resp.json() as { updates?: { updatedRange?: string } };

    return [{ range: result.updates?.updatedRange || 'appended', status: 'row appended' }];
  },
});
