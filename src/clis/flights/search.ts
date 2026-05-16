/**
 * 机票查询 — 支持多数据源 (携程 / 飞猪 / 去哪儿)
 *
 * Usage:
 *   opencli flights search 上海 北京
 *   opencli flights search MEL 厦门 --date 2026-04-22 --return 2026-05-06
 *   opencli flights search 深圳 成都 --source fliggy
 */
import { cli, Strategy } from '../../registry.js';
import { tomorrow } from './common.js';
import { ctrip } from './ctrip.js';
import type { FlightSource } from './common.js';

const SOURCES: Record<string, FlightSource> = {
  ctrip,
};

cli({
  site: 'flights',
  name: 'search',
  access: 'read',
  description: '机票查询',
  domain: 'flights.ctrip.com',
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  args: [
    { name: 'from', required: true, positional: true, help: '出发城市 (如: 上海 / SHA)' },
    { name: 'to', required: true, positional: true, help: '到达城市 (如: 北京 / BJS)' },
    { name: 'date', help: '出发日期 YYYY-MM-DD (默认明天)' },
    { name: 'return', help: '返程日期 YYYY-MM-DD (不填则查单程)' },
    { name: 'source', help: '数据源 (默认 ctrip)', choices: ['ctrip'], default: 'ctrip' },
    { name: 'limit', type: 'int', default: 15, help: '每段显示条数' },
  ],
  columns: ['rank', 'leg', 'source', 'airline', 'flightNo', 'depart', 'arrive', 'duration', 'stops', 'price'],
  func: async (page, kwargs) => {
    const from = kwargs.from;
    const to = kwargs.to;
    const date = kwargs.date || tomorrow();
    const rdate = kwargs.return;
    const limit = kwargs.limit || 15;
    const sourceName = kwargs.source || 'ctrip';

    const source = SOURCES[sourceName];
    if (!source) return [{ error: `未知数据源: ${sourceName}, 可选: ${Object.keys(SOURCES).join(', ')}` }];

    const legs = [
      { from, to, label: '去程', date },
      ...(rdate ? [{ from: to, to: from, label: '返程', date: rdate }] : []),
    ];
    const isRoundTrip = legs.length > 1;

    const allResults: any[] = [];
    for (const leg of legs) {
      const flights = await source.search(page, leg.from, leg.to, leg.date, limit);
      for (const f of flights) {
        allResults.push({
          leg: isRoundTrip ? `${leg.label} ${leg.date}` : '',
          ...f,
        });
      }
    }

    return allResults.map((f: any, i: number) => ({ rank: i + 1, ...f }));
  },
});
