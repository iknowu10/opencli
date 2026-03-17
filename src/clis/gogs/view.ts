import { cli, Strategy } from '../../registry.js';
import { GOGS_URL, gogsAPI } from '../../gogs.js';

cli({
  site: 'gogs',
  name: 'view',
  description: 'View a pull request on Gogs',
  domain: 'gogs.zyuncai.com',
  strategy: Strategy.COOKIE,
  browser: false,
  args: [
    { name: 'owner', required: true, help: 'Repo owner' },
    { name: 'repo', required: true, help: 'Repo name' },
    { name: 'number', type: 'int' as const, required: true, help: 'PR number' },
  ],
  columns: ['number', 'title', 'state', 'author', 'merged', 'createdAt', 'url'],
  func: async (_page, kwargs) => {
    const { owner, repo, number } = kwargs;
    const p = await gogsAPI(`/repos/${owner}/${repo}/issues/${number}`);
    return [{
      number: p.number,
      title: p.title ?? '',
      state: p.state ?? '',
      author: p.user?.login ?? '',
      merged: p.pull_request?.merged ? 'yes' : 'no',
      createdAt: (p.created_at ?? '').slice(0, 10),
      url: `${GOGS_URL}/${owner}/${repo}/pulls/${number}`,
    }];
  },
});
