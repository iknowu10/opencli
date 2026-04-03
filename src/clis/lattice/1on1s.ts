import { cli, Strategy } from '../../registry.js';
import { latticeNavigate, latticeEval, latticePrevMeeting } from '../../lattice.js';

cli({
  site: 'lattice',
  name: '1on1s',
  description: 'View items written in your 1:1 meetings from Lattice',
  domain: 'latticehq.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'limit', type: 'int' as const, default: 30, help: 'Max items to return' },
    { name: 'meetings', type: 'int' as const, default: 5, help: 'Number of recent meetings to scan' },
    { name: 'person', default: '', help: 'Filter by person name (partial match)' },
  ],
  columns: ['meetingDate', 'with', 'agenda', 'actions', 'notes'],
  func: async (page, kwargs) => {
    const itemLimit = Number(kwargs.limit) || 30;
    const meetingCount = Number(kwargs.meetings) || 5;
    const personFilter = String(kwargs.person || '').toLowerCase();

    // Navigate to user's 1:1 list page
    await latticeNavigate(page, '/');
    await page.wait(2);

    // Find the current user's 1:1 page URL
    const userOneOnOneUrl = await latticeEval(page, `
      (() => {
        const link = [...document.querySelectorAll('a')]
          .find(a => a.href.includes('/1-1s') && a.textContent.includes('All 1:1s'));
        if (link) return link.href.replace(/\\/1-1s.*/, '/1-1s');
        // Fallback: find user ID from sidebar
        const userLink = [...document.querySelectorAll('a')]
          .find(a => a.href.includes('/users/') && a.href.includes('/feedback'));
        if (userLink) {
          const uid = userLink.href.match(/\\/users\\/([^/]+)/)?.[1];
          return uid ? location.origin + '/users/' + uid + '/1-1s' : null;
        }
        return null;
      })()
    `) as string | null;

    if (!userOneOnOneUrl) throw new Error('Could not find 1:1s page URL');

    await page.goto(userOneOnOneUrl, { settleMs: 2000 });

    // Get list of 1:1 relationships with their URLs
    const relationships = await latticeEval(page, `
      (() => {
        const links = [...document.querySelectorAll('a')]
          .filter(a => a.href.includes('/1-1s/') && !a.href.includes('/users/'));
        const seen = new Set();
        const results = [];
        for (const a of links) {
          const href = a.href.split('?')[0];
          if (seen.has(href)) continue;
          seen.add(href);
          const name = a.querySelector('span')?.textContent?.trim() ||
                       a.textContent?.replace(/[^a-zA-Z ]/g, '').trim() || '';
          if (name) results.push({ name, url: href });
        }
        return results;
      })()
    `) as { name: string; url: string }[];

    // Filter by person if specified
    const targets = personFilter
      ? relationships.filter(r => r.name.toLowerCase().includes(personFilter))
      : relationships;

    const items: any[] = [];

    for (const rel of targets) {
      if (items.length >= itemLimit) break;

      // Navigate to this 1:1
      await page.goto(rel.url, { settleMs: 2500 });

      // Scrape meetings by navigating backwards
      for (let i = 0; i < meetingCount; i++) {
        if (items.length >= itemLimit) break;

        const meeting = await latticeEval(page, `
          (() => {
            const text = document.body.innerText;
            const dateMatch = text.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\\s+(\\w+\\s+\\d+,\\s+\\d{4})/);
            const date = dateMatch ? dateMatch[0] : 'unknown';

            // Extract agenda section (between "Agenda" and "Add talking point")
            const agendaParts = text.split('Agenda');
            const agendaRaw = agendaParts[1]?.split('Add talking point')[0]?.trim() || '';

            // Extract action items (between "Action Items" and "Add action item")
            const actionParts = text.split('Action Items');
            const actionsRaw = actionParts[1]?.split('Add action item')[0]?.trim() || '';

            // Extract shared notes (between "Shared notes" marker and "Add private notes")
            const notesParts = text.split('Shared notes will be visible to both');
            const notesRaw = notesParts[1]?.split('Add private notes')[0]?.trim() || '';

            return { date, agenda: agendaRaw, actions: actionsRaw, notes: notesRaw };
          })()
        `) as { date: string; agenda: string; actions: string; notes: string };

        items.push({
          meetingDate: meeting.date,
          with: rel.name,
          agenda: meeting.agenda.replace(/\n/g, ' ').slice(0, 200),
          actions: meeting.actions.replace(/\n/g, ' ').slice(0, 150),
          notes: meeting.notes.replace(/\n/g, ' ').slice(0, 150),
        });

        // Navigate to previous meeting
        const hasPrev = await latticePrevMeeting(page);
        if (!hasPrev) break;
      }
    }

    return items;
  },
});
