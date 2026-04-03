/**
 * Ctrip (携程) flight source
 */
import type { IPage } from '../../types.js';
import type { FlightSource, FlightResult } from './common.js';
import { toCode } from './common.js';

const EXTRACT_SCRIPT = `
  (() => {
    const results = [];
    let cards = document.querySelectorAll('[class*="flight-item"], [class*="FlightItem"], .lg-item-wrapper, [role="listitem"]');
    if (cards.length === 0) cards = document.querySelectorAll('[class*="list-item"], [class*="product-item"]');
    if (cards.length === 0) return [];

    const flightNoRe = /\\b([A-Z0-9]{2}\\d{3,4})\\b/g;
    const durationRe = /(\\d+h(?:\\d+m)?|\\d+小时(?:\\d+分)?)/;
    const nextDayRe = /\\+1天/;

    for (const card of cards) {
      const text = card.innerText || '';
      const lines = text.split('\\n').map(s => s.trim()).filter(Boolean);
      if (lines.length < 3) continue;

      const airline = lines.find(l => /^[\\u4e00-\\u9fff|｜·\\s]+$/.test(l) && !/\\d/.test(l)) || '';
      const fnMatches = text.match(flightNoRe) || [];
      const flightNo = fnMatches.join('/');

      const allTimes = [];
      let m;
      const timeRe = /\\b(\\d{2}:\\d{2})\\b/g;
      while ((m = timeRe.exec(text)) !== null) allTimes.push(m[1]);
      const depart = allTimes[0] || '';
      let arrive = allTimes[1] || '';
      if (nextDayRe.test(text)) arrive += '+1';

      const durMatch = text.match(durationRe);
      const duration = durMatch ? durMatch[1] : '';

      const prices = [];
      const priceRe = /[¥￥](\\d[\\d,]*)/g;
      while ((m = priceRe.exec(text)) !== null) prices.push(Number(m[1].replace(/,/g, '')));
      const price = prices.length ? Math.min(...prices) : '';

      const stops = fnMatches.length > 1 ? (fnMatches.length - 1) + '转' : '直飞';

      if (depart || price) {
        results.push({ airline, flightNo, depart, arrive, duration, stops, price });
      }
    }
    return results;
  })()
`;

export const ctrip: FlightSource = {
  name: '携程',
  domain: 'flights.ctrip.com',
  async search(page: IPage, from: string, to: string, date: string, limit: number): Promise<FlightResult[]> {
    const f = toCode(from);
    const t = toCode(to);
    const url = `https://flights.ctrip.com/online/list/oneway-${f}-${t}?depdate=${date}`;
    await page.goto(url);
    await page.wait(5);
    await page.autoScroll({ times: 2, delayMs: 800 });

    const raw = await page.evaluate(EXTRACT_SCRIPT);
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, limit).map((r: any) => ({ source: '携程', ...r }));
  },
};
