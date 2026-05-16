import { CliError } from '../../errors.js';
import { cli, Strategy } from '../../registry.js';
import { ensureGoogleSession, googleFetch, parseSheetId } from './utils.js';

cli({
  site: 'google-sheets',
  name: 'write',
  access: 'write',
  description: 'Write values to Google Sheet cells (requires Chrome login)',
  domain: 'docs.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'sheet-id', positional: true, required: true, help: 'Spreadsheet ID or full URL' },
    { name: 'cell', required: true, help: 'Starting cell, e.g. A1' },
    { name: 'values', required: true, help: 'Values: comma-separated for columns, semicolon for rows. e.g. "a,b,c;d,e,f"' },
  ],
  columns: ['range', 'cells', 'status'],
  func: async (page, args) => {
    const sheetId = parseSheetId(String(args['sheet-id']));
    const cell = String(args.cell).toUpperCase();
    const valuesStr = String(args.values);

    if (!/^[A-Z]+\d+$/.test(cell)) {
      throw new CliError('ARGUMENT', 'Invalid cell reference', 'Use format like A1, B3, AA10');
    }

    // Parse values: comma = columns, semicolon = rows
    const rows = valuesStr.split(';').map((r) => r.split(',').map((v) => v.trim()));

    const cookies = await ensureGoogleSession(page);

    // Calculate end cell for the range
    const colMatch = cell.match(/^([A-Z]+)/);
    const rowMatch = cell.match(/(\d+)$/);
    const startCol = colMatch![1];
    const startRow = parseInt(rowMatch![1], 10);
    const maxCols = Math.max(...rows.map((r) => r.length));
    const endCol = colOffset(startCol, maxCols - 1);
    const endRow = startRow + rows.length - 1;
    const range = `Sheet1!${cell}:${endCol}${endRow}`;

    // Use Sheets API v4 to update values
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      body: JSON.stringify({ range, majorDimension: 'ROWS', values: rows }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new CliError('FETCH_ERROR', `Sheets API returned ${resp.status}`, errText.slice(0, 200));
    }

    const result = await resp.json() as { updatedRange?: string; updatedCells?: number };
    const totalCells = rows.reduce((sum, r) => sum + r.length, 0);

    return [{ range: result.updatedRange || range, cells: result.updatedCells || totalCells, status: 'written' }];
  },
});

/** Offset a column letter by n positions (A + 2 = C) */
function colOffset(col: string, n: number): string {
  let num = 0;
  for (const ch of col) num = num * 26 + (ch.charCodeAt(0) - 64);
  num += n;
  let result = '';
  while (num > 0) {
    const rem = (num - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}
