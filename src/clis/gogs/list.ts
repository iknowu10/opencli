import { cli, Strategy } from '../../registry.js';
import { GOGS_URL, gogsLogin, gogsWebGet } from '../../gogs.js';

cli({
  site: 'gogs',
  name: 'list',
  description: 'List pull requests on Gogs',
  domain: 'gogs.zyuncai.com',
  strategy: Strategy.COOKIE,
  browser: false,
  args: [
    { name: 'owner', required: true, help: 'Repo owner' },
    { name: 'repo', required: true, help: 'Repo name' },
    { name: 'state', default: 'open', help: 'PR state: open or closed' },
  ],
  columns: ['number', 'title', 'author', 'url'],
  func: async (_page, kwargs) => {
    const { owner, repo, state } = kwargs;
    const jar = await gogsLogin();
    const html = await gogsWebGet(`/${owner}/${repo}/pulls?type=comment&state=${state}`, jar);

    const rows: any[] = [];
    const seen = new Set<string>();
    // Match PR list items: link contains /pulls/{number}
    const re = /href="\/[^"]+\/pulls\/(\d+)"[^>]*>\s*([^<]{3,})/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const [, number, rawTitle] = m;
      const title = rawTitle.trim();
      if (seen.has(number) || !title || title.length < 3) continue;
      seen.add(number);
      // Try to extract author from nearby context
      const authorMatch = html.slice(Math.max(0, m.index - 300), m.index + 500)
        .match(/href="\/([^"\/]+)"\s*class="[^"]*author/);
      rows.push({
        number,
        title,
        author: authorMatch?.[1] ?? '',
        url: `${GOGS_URL}/${owner}/${repo}/pulls/${number}`,
      });
    }
    return rows;
  },
});
