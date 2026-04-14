/**
 * 携程机票搜索 — 通过浏览器提取航班数据，支持国内和国际。
 *
 * Usage:
 *   opencli ctrip flight 上海 北京
 *   opencli ctrip flight MEL 厦门 --date 2026-05-20
 *   opencli ctrip flight 上海 东京 --date 2026-05-20 --return 2026-05-27
 */
import { cli, Strategy } from '@jackwener/opencli/registry';
import { toFlightCode, tomorrow } from './common.js';

cli({
  site: 'ctrip',
  name: 'flight',
  description: '机票搜索（携程，国内+国际）',
  domain: 'flights.ctrip.com',
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  timeoutSeconds: 90,
  args: [
    { name: 'from', required: true, positional: true, help: '出发城市 (如: 上海 / SHA)' },
    { name: 'to', required: true, positional: true, help: '到达城市 (如: 北京 / BJS)' },
    { name: 'date', help: '出发日期 YYYY-MM-DD (默认明天)' },
    { name: 'return', help: '返程日期 YYYY-MM-DD (不填查单程)' },
    { name: 'limit', type: 'int', default: 15, help: '显示条数' },
  ],
  columns: ['rank', 'leg', 'airline', 'flightNo', 'depart', 'arrive', 'stops', 'price'],
  func: async (page, kwargs) => {
    const from = toFlightCode(kwargs.from);
    const to = toFlightCode(kwargs.to);
    const date = kwargs.date || tomorrow();
    const rdate = kwargs.return;
    const limit = kwargs.limit || 15;

    const legs = [
      { from, to, label: '去程', date },
      ...(rdate ? [{ from: to, to: from, label: '返程', date: rdate }] : []),
    ];
    const isRoundTrip = legs.length > 1;
    const allResults = [];

    for (const leg of legs) {
      const url = `https://flights.ctrip.com/online/list/oneway-${leg.from}-${leg.to}?depdate=${leg.date}`;
      await page.goto(url);
      await page.wait(12);
      try { await page.autoScroll({ times: 3, delayMs: 1000 }); } catch(e) { /* ignore */ }
      await page.wait(3);

      const raw = await page.evaluate(`
        (() => {
          const results = [];
          const cards = document.querySelectorAll('.flight-item');
          if (cards.length === 0) return [];
          for (const card of cards) {
            const text = card.innerText || '';
            const lines = text.split(String.fromCharCode(10)).map(s => s.trim()).filter(Boolean);
            if (lines.length < 3) continue;
            const airline = lines[0] || '';
            const fnRe = new RegExp('[A-Z][A-Z0-9]' + String.fromCharCode(92) + 'd{3,4}', 'g');
            const fnMatch = text.match(fnRe) || [];
            const flightNo = fnMatch.join('/');
            const times = [];
            const tr = new RegExp(String.fromCharCode(92) + 'd{2}:' + String.fromCharCode(92) + 'd{2}', 'g');
            let m;
            while ((m = tr.exec(text)) !== null) times.push(m[0]);
            const depart = times[0] || '';
            let arrive = times[1] || '';
            if (text.includes('+1')) arrive += '+1';
            const prices = [];
            const pr = /[¥￥](\\d[\\d,]*)/g;
            while ((m = pr.exec(text)) !== null) prices.push(Number(m[1].replace(/,/g, '')));
            const price = prices.length ? Math.min(...prices) : '';
            const stops = fnMatch.length > 1 ? (fnMatch.length - 1) + '转' : '直飞';
            if (depart || price) {
              results.push({ airline, flightNo, depart, arrive, stops, price });
            }
          }
          return results;
        })()
      `);

      if (Array.isArray(raw)) {
        for (const f of raw) {
          allResults.push({
            leg: isRoundTrip ? `${leg.label} ${leg.date}` : '',
            ...f,
          });
        }
      }
    }

    return allResults.slice(0, limit).map((f, i) => ({ rank: i + 1, ...f }));
  },
});
