import { cli, Strategy } from '../../registry.js';
import { latticeNavigate, latticeEval } from '../../lattice.js';

cli({
  site: 'lattice',
  name: 'feedback',
  description: 'View feedback you have received in Lattice',
  domain: 'latticehq.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' },
    { name: 'tab', default: 'received', help: 'Tab to view: received, given, pending, all' },
  ],
  columns: ['date', 'from', 'message'],
  func: async (page, kwargs) => {
    const limit = Number(kwargs.limit) || 20;
    const tab = String(kwargs.tab || 'received').toLowerCase();

    // Navigate to home to find feedback URL
    await latticeNavigate(page, '/');
    await page.wait(2);

    const feedbackUrl = await latticeEval(page, `
      (() => {
        const link = [...document.querySelectorAll('a')]
          .find(a => a.href.includes('/feedback') && a.href.includes('/users/'));
        return link?.href || null;
      })()
    `) as string | null;

    if (feedbackUrl) {
      await page.goto(feedbackUrl, { settleMs: 2500 });
    } else {
      await latticeNavigate(page, '/feedback');
      await page.wait(2);
    }

    // Click the appropriate tab
    const tabLabel = tab === 'given' ? "You've given"
      : tab === 'pending' ? 'Pending requests'
      : tab === 'all' ? 'All feedback'
      : "You've received";

    await latticeEval(page, `
      (() => {
        const tabs = [...document.querySelectorAll('button, [role="tab"], a')];
        const target = tabs.find(t => t.textContent?.includes('${tabLabel}'));
        if (target) target.click();
      })()
    `);
    await page.wait(2);

    // Scrape feedback items
    const items = await latticeEval(page, `
      (() => {
        const results = [];
        const main = document.querySelector('main, [role="main"]') || document.body;
        const text = main.innerText;

        // Look for feedback cards/entries
        const cards = document.querySelectorAll('[data-testid*="feedback-card"], [class*="FeedbackCard"], article');
        if (cards.length > 0) {
          for (const card of cards) {
            const cardText = card.innerText;
            const lines = cardText.split('\\n').filter(l => l.trim());
            // Typical structure: name, date, message body
            const dateMatch = cardText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d+,?\\s*\\d{4}/);
            results.push({
              date: dateMatch ? dateMatch[0] : '',
              from: lines[0]?.trim()?.slice(0, 50) || '',
              message: lines.slice(1).join(' ').replace(/\\s+/g, ' ').trim().slice(0, 200),
            });
          }
        }

        // If no cards found, check if page shows empty state
        if (results.length === 0) {
          if (text.includes('Ask, and you shall receive') || text.includes('No feedback')) {
            return [{ date: '', from: '(empty)', message: 'No feedback entries found in this tab' }];
          }
          // Try to parse any visible feedback from the text
          results.push({
            date: '',
            from: '',
            message: text.substring(text.indexOf('Feedback') + 8).trim().slice(0, 300),
          });
        }

        return results;
      })()
    `) as { date: string; from: string; message: string }[];

    return items.slice(0, limit);
  },
});
