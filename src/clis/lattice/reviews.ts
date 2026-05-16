import { cli, Strategy } from '../../registry.js';
import { latticeNavigate, latticeEval } from '../../lattice.js';

cli({
  site: 'lattice',
  name: 'reviews',
  access: 'read',
  description: 'List performance review packets from Lattice',
  domain: 'latticehq.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' },
  ],
  columns: ['cycle', 'stage', 'status', 'action'],
  func: async (page, kwargs) => {
    const limit = Number(kwargs.limit) || 20;

    // Navigate to the home page first to find the user's reviews URL
    await latticeNavigate(page, '/');
    await page.wait(2);

    const reviewsUrl = await latticeEval(page, `
      (() => {
        const link = [...document.querySelectorAll('a')]
          .find(a => a.href.includes('/reviews') && a.href.includes('/users/'));
        return link?.href || null;
      })()
    `) as string | null;

    if (reviewsUrl) {
      await page.goto(reviewsUrl, { settleMs: 2500 });
    } else {
      // Try the generic path
      await latticeNavigate(page, '/users/me/reviews');
      await page.wait(2);
    }

    // Scrape review packets from the table
    const items = await latticeEval(page, `
      (() => {
        const results = [];

        // Try table rows first
        const rows = document.querySelectorAll('table tbody tr, [role="row"]');
        if (rows.length > 0) {
          for (const row of rows) {
            const cells = row.querySelectorAll('td, [role="cell"]');
            if (cells.length >= 3) {
              results.push({
                cycle: cells[0]?.innerText?.trim()?.slice(0, 80) || '',
                stage: cells[1]?.innerText?.trim() || '',
                status: cells[2]?.innerText?.trim() || '',
                action: cells[3]?.innerText?.trim() || '',
              });
            }
          }
        }

        // Fallback: parse from page text
        if (results.length === 0) {
          const text = document.body.innerText;
          // Look for the table header to find the start of data
          const headerIdx = text.indexOf('CYCLE NAME');
          if (headerIdx > -1) {
            const afterHeader = text.substring(headerIdx + 'CYCLE NAME'.length);
            const lines = afterHeader.split('\\n').filter(l => l.trim());
            // Skip header items (STAGE, STATUS, etc.)
            let i = 0;
            while (i < lines.length && (lines[i].trim() === 'STAGE' || lines[i].trim() === 'STATUS' || lines[i].trim() === '')) i++;

            while (i < lines.length - 1) {
              const cycle = lines[i]?.trim() || '';
              const stage = lines[i + 1]?.trim() || '';
              const status = lines[i + 2]?.trim() || '';
              const action = lines[i + 3]?.trim() || '';

              // Validate: stage should be a known value
              if (['Write reviews', 'View results', 'Share results', 'Peer selection', 'Self review'].some(s => stage.includes(s))) {
                results.push({ cycle: cycle.slice(0, 80), stage, status, action });
                i += 4;
              } else {
                i++;
              }
            }
          }
        }

        return results;
      })()
    `) as { cycle: string; stage: string; status: string; action: string }[];

    return items.slice(0, limit);
  },
});
