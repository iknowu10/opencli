import { cli, Strategy } from '../../registry.js';
import { GOGS_URL, gogsLogin, gogsWebPost } from '../../gogs.js';

cli({
  site: 'gogs',
  name: 'create',
  description: 'Create a pull request on Gogs',
  domain: 'gogs.zyuncai.com',
  strategy: Strategy.COOKIE,
  browser: false,
  args: [
    { name: 'owner', required: true, help: 'Repo owner (e.g. suzhi)' },
    { name: 'repo', required: true, help: 'Repo name (e.g. twms)' },
    { name: 'head', required: true, help: 'Head branch (source)' },
    { name: 'base', default: 'develop', help: 'Base branch (target)' },
    { name: 'title', required: true, help: 'PR title' },
    { name: 'body', default: '', help: 'PR body / description' },
  ],
  columns: ['number', 'title', 'url'],
  func: async (_page, kwargs) => {
    const { owner, repo, head, base, title, body } = kwargs;
    const jar = await gogsLogin();
    const path = `/${owner}/${repo}/compare/${base}...${head}`;
    const location = await gogsWebPost(path, jar, { title, content: body });
    const match = location.match(/\/pulls\/(\d+)/);
    const number = match?.[1] ?? '?';
    return [{ number, title, url: `${GOGS_URL}/${owner}/${repo}/pulls/${number}` }];
  },
});
