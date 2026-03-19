import { execSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const statusCommand = cli({
  site: 'wechat',
  name: 'status',
  description: 'Check if WeChat Desktop is running on macOS',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['Status', 'Detail'],
  func: async (page: IPage | null) => {
    try {
      const running = execSync("osascript -e 'application \"WeChat\" is running'", { encoding: 'utf-8' }).trim();
      if (running !== 'true') {
        return [{ Status: 'Stopped', Detail: 'WeChat is not running' }];
      }

      // Get window count to check if logged in
      const windowCount = execSync(
        "osascript -e 'tell application \"System Events\" to count windows of application process \"WeChat\"'",
        { encoding: 'utf-8' }
      ).trim();

      return [{
        Status: 'Running',
        Detail: `${windowCount} window(s) open`,
      }];
    } catch (err: any) {
      return [{ Status: 'Error', Detail: err.message }];
    }
  },
});
