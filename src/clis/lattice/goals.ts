import { cli, Strategy } from '../../registry.js';
import { latticeNavigate, latticeEval } from '../../lattice.js';

cli({
  site: 'lattice',
  name: 'goals',
  description: 'List your goals/OKRs from Lattice',
  domain: 'latticehq.com',
  strategy: Strategy.UI,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Max goals to return' },
    { name: 'person', default: '', help: 'Show goals for a specific person (partial name match). Omit for company goals.' },
    { name: 'detail', type: 'boolean' as const, default: false, help: 'Drill into each goal for sub-goals, measurements, and latest updates' },
  ],
  columns: ['title', 'type', 'progress', 'due', 'status', 'parent', 'latestUpdate'],
  func: async (page, kwargs) => {
    const limit = Number(kwargs.limit) || 20;
    const personFilter = String(kwargs.person || '').toLowerCase();
    const detail = !!kwargs.detail;

    // ── Person-specific goals: navigate to their profile ──
    if (personFilter) {
      await latticeNavigate(page, '/team');
      await page.wait(2);

      const filterVal = personFilter; // capture for JS injection
      const userUrl = await latticeEval(page,
        '(() => {' +
        '  const links = [...document.querySelectorAll("a")]' +
        '    .filter(a => a.href.includes("/users/") && !a.href.includes("/feedback") && !a.href.includes("/reviews"));' +
        '  const match = links.find(a => a.textContent.trim().toLowerCase().includes("' + filterVal + '"));' +
        '  return match?.href || null;' +
        '})()'
      ) as string | null;

      if (!userUrl) {
        await latticeNavigate(page, '/company/directory');
        await page.wait(2);
        const dirUrl = await latticeEval(page,
          '(() => {' +
          '  const links = [...document.querySelectorAll("a")]' +
          '    .filter(a => a.href.includes("/users/"));' +
          '  const match = links.find(a => a.textContent.trim().toLowerCase().includes("' + filterVal + '"));' +
          '  return match?.href || null;' +
          '})()'
        ) as string | null;
        if (!dirUrl) throw new Error('Could not find user matching "' + kwargs.person + '"');
        await page.goto(dirUrl, { settleMs: 2500 });
      } else {
        await page.goto(userUrl, { settleMs: 2500 });
      }

      // Expand "Show more goals" if present
      await latticeEval(page,
        '(() => {' +
        '  const btn = [...document.querySelectorAll("button")]' +
        '    .find(b => b.textContent.includes("Show more goals"));' +
        '  if (btn) btn.click();' +
        '})()'
      );
      await page.wait(1);

      // Collect goal links from the profile
      const goalLinks = await latticeEval(page,
        '(() => {' +
        '  return [...document.querySelectorAll("a")]' +
        '    .filter(a => a.href.includes("/goals/") && !a.href.includes("explore") && !a.href.includes("create")' +
        '      && !a.href.includes("reporting") && !a.href.includes("participation") && !a.href.includes("status"))' +
        '    .map(a => {' +
        '      let container = a;' +
        '      for (let i = 0; i < 3; i++) { if (container.parentElement) container = container.parentElement; }' +
        '      const text = container.innerText || "";' +
        '      const progressMatch = text.match(/(\\d+)\\s*%/);' +
        '      const statusMatch = text.match(/(ON TRACK|AT RISK|BEHIND|NO UPDATE|ACHIEVED|MISSED)/i);' +
        '      return {' +
        '        url: a.href.split("?")[0],' +
        '        title: a.textContent.replace(/Open New Icon.*|\\(opens in new tab\\)/g, "").trim(),' +
        '        progress: progressMatch ? progressMatch[1] + "%" : "",' +
        '        status: statusMatch ? statusMatch[1] : "",' +
        '      };' +
        '    })' +
        '    .filter((g, i, arr) => g.title && arr.findIndex(x => x.url === g.url) === i);' +
        '})()'
      ) as { url: string; title: string; progress: string; status: string }[];

      // Summary mode: return profile-level info
      if (!detail) {
        return goalLinks.slice(0, limit).map(g => ({
          title: g.title,
          type: '',
          progress: g.progress,
          due: '',
          status: g.status,
          parent: '',
          latestUpdate: '',
        }));
      }

      // Detail mode: visit each goal page
      const items: any[] = [];
      for (const goal of goalLinks.slice(0, limit)) {
        await page.goto(goal.url, { settleMs: 2500 });

        const info = await latticeEval(page, GOAL_DETAIL_JS) as GoalDetail;

        items.push({
          title: goal.title,
          type: info.type || 'Binary',
          progress: info.progressDetail || goal.progress,
          due: info.due,
          status: info.status || goal.status,
          parent: info.parent,
          latestUpdate: info.latestUpdate.slice(0, 120),
        });

        for (const sub of info.subGoals) {
          items.push({
            title: '  \u21b3 ' + sub.name,
            type: '',
            progress: sub.progress,
            due: sub.due,
            status: '',
            parent: goal.title,
            latestUpdate: '',
          });
        }
      }

      return items;
    }

    // ── Company-wide goals: use /goals/explore ──
    await latticeNavigate(page, '/goals/explore');
    await page.wait(3);

    const items = await latticeEval(page,
      '(() => {' +
      '  const results = [];' +
      '  const text = document.body.innerText;' +
      '  const headerIdx = text.indexOf("Last updated");' +
      '  if (headerIdx > -1) {' +
      '    const afterHeader = text.substring(headerIdx + "Last updated".length);' +
      '    const lines = afterHeader.split("\\n").filter(l => l.trim());' +
      '    let i = 0;' +
      '    while (i < lines.length - 2) {' +
      '      const line = lines[i].trim();' +
      '      if (line === "Status" || line === "CSV" || line.startsWith("\\u00d7")) { i++; continue; }' +
      '      const title = line;' +
      '      const owners = lines[i + 1]?.trim() || "";' +
      '      const due = lines[i + 2]?.trim() || "";' +
      '      const lastUpdated = lines[i + 3]?.trim() || "";' +
      '      const progress = lines[i + 4]?.trim() || "";' +
      '      if (due.match(/\\d{4}$/) || due === "Never") {' +
      '        results.push({ title: title.slice(0, 100), type: owners, progress, due, status: "", parent: "", latestUpdate: lastUpdated });' +
      '        i += 5;' +
      '      } else { i++; }' +
      '    }' +
      '  }' +
      '  return results;' +
      '})()'
    ) as any[];

    return items.slice(0, limit);
  },
});

// ── JS snippet to extract detail from a single goal page ──
const GOAL_DETAIL_JS = `
  (() => {
    const text = document.body.innerText;

    // Progress: e.g. "0.55/1 (Binary, 55%)" or "10/100% (10%)"
    const progressMatch = text.match(/([\\d.]+\\/[\\d.]+%?\\s*\\([^)]+\\))/);
    const progressDetail = progressMatch ? progressMatch[1] : '';

    const typeMatch = progressDetail.match(/\\((Binary|Percentage|Number|Currency)[^)]*\\)/i);
    const type = typeMatch ? typeMatch[1] : '';

    const dueMatch = text.match(/Due\\n([^\\n]+)/);
    const due = dueMatch ? dueMatch[1].trim() : '';

    const statusMatch = text.match(/(ON TRACK|AT RISK|BEHIND|NO UPDATE|ACHIEVED|MISSED)/i);
    const status = statusMatch ? statusMatch[1] : '';

    // Parent goal
    const parentSection = text.split('Parent')[1]?.split('Supported by')[0] || '';
    const parentMatch = parentSection.match(/\\n([^\\n]+)\\nDue:/);
    const parent = parentMatch ? parentMatch[1].trim() : '';

    // Sub-goals
    const supportedSection = text.split('Supported by')[1]?.split('Details')[0] || '';
    const subGoals = [];
    const subRegex = /([^\\n]+)\\n+Due:\\s*([^\\n]+)\\n(\\d+%)/g;
    let m;
    while ((m = subRegex.exec(supportedSection)) !== null) {
      const name = m[1].replace(/Open New Icon.*|\\(opens in new tab\\)/g, '').trim();
      if (name && !name.includes('Add ') && !name.includes('Adjust') && !name.includes('No supporting')) {
        subGoals.push({ name, due: m[2].trim(), progress: m[3] });
      }
    }

    // Latest update
    const updateSection = text.split('Latest update')[1]?.split('Aligned goals')[0] || '';
    const noteMatch = updateSection.match(/Note\\n([^\\n]+)/);
    const latestUpdate = noteMatch ? noteMatch[1].trim() : '';

    return { progressDetail, type, due, status, parent, subGoals, latestUpdate };
  })()
`;

interface GoalDetail {
  progressDetail: string;
  type: string;
  due: string;
  status: string;
  parent: string;
  subGoals: { name: string; due: string; progress: string }[];
  latestUpdate: string;
}
