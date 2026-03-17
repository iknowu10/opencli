import { cli, Strategy } from '../../registry.js';
import { GOGS_URL, gogsAPI } from '../../gogs.js';

cli({
  site: 'gogs',
  name: 'update',
  description: 'Update a pull request on Gogs (title, body, state)',
  domain: 'gogs.zyuncai.com',
  strategy: Strategy.COOKIE,
  browser: false,
  args: [
    { name: 'owner', required: true, help: 'Repo owner' },
    { name: 'repo', required: true, help: 'Repo name' },
    { name: 'number', type: 'int' as const, required: true, help: 'PR number' },
    { name: 'title', default: '', help: 'New title' },
    { name: 'body', default: '', help: 'New body' },
    { name: 'state', default: '', help: 'New state: open or closed' },
  ],
  columns: ['number', 'title', 'state', 'url'],
  func: async (_page, kwargs) => {
    const { owner, repo, number, title, body, state } = kwargs;
    const patch: Record<string, any> = {};
    if (title) patch.title = title;
    if (body) patch.body = body;
    if (state) patch.state = state;
    if (!Object.keys(patch).length) throw new Error('Provide at least one of --title, --body, --state');

    const p = await gogsAPI(`/repos/${owner}/${repo}/issues/${number}`, { method: 'PATCH', body: patch });
    return [{
      number: p.number,
      title: p.title ?? '',
      state: p.state ?? '',
      url: `${GOGS_URL}/${owner}/${repo}/pulls/${number}`,
    }];
  },
});
