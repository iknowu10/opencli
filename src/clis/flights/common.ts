/**
 * Shared utilities for the flights CLI — city codes, helpers, types.
 */
import type { IPage } from '../../types.js';

// ── City code mapping ──────────────────────────────────────────────
// code → Chinese name (bidirectional lookup)
export const CITY_MAP: Record<string, { code: string; cn: string }> = {};

const RAW: Record<string, string> = {
  北京: 'BJS', 上海: 'SHA', 广州: 'CAN', 深圳: 'SZX',
  成都: 'CTU', 杭州: 'HGH', 重庆: 'CKG', 武汉: 'WUH',
  西安: 'SIA', 南京: 'NKG', 长沙: 'CSX', 厦门: 'XMN',
  昆明: 'KMG', 大连: 'DLC', 天津: 'TSN', 青岛: 'TAO',
  三亚: 'SYX', 海口: 'HAK', 郑州: 'CGO', 福州: 'FOC',
  合肥: 'HFE', 贵阳: 'KWE', 南宁: 'NNG', 哈尔滨: 'HRB',
  沈阳: 'SHE', 济南: 'TNA', 乌鲁木齐: 'URC', 兰州: 'LHW',
  拉萨: 'LXA', 银川: 'INC', 西宁: 'XNN', 呼和浩特: 'HET',
  石家庄: 'SJW', 太原: 'TYN', 南昌: 'KHN', 珠海: 'ZUH',
  无锡: 'WUX', 宁波: 'NGB', 温州: 'WNZ', 烟台: 'YNT',
  香港: 'HKG', 澳门: 'MFM', 台北: 'TPE',
  东京: 'TYO', 大阪: 'OSA', 首尔: 'SEL', 曼谷: 'BKK',
  新加坡: 'SIN', 吉隆坡: 'KUL', 伦敦: 'LON', 巴黎: 'PAR',
  纽约: 'NYC', 洛杉矶: 'LAX', 旧金山: 'SFO', 悉尼: 'SYD',
  墨尔本: 'MEL',
};

// Build bidirectional lookup
for (const [cn, code] of Object.entries(RAW)) {
  CITY_MAP[cn] = { code, cn };
  CITY_MAP[code] = { code, cn };
}

/** Resolve user input to airport code (e.g. "上海" → "SHA", "SHA" → "SHA") */
export function toCode(input: string): string {
  const entry = CITY_MAP[input] || CITY_MAP[input.toUpperCase()];
  if (entry) return entry.code;
  if (/^[A-Z]{3}$/i.test(input)) return input.toUpperCase();
  return input;
}

/** Resolve user input to Chinese city name (e.g. "SHA" → "上海", "上海" → "上海") */
export function toChinese(input: string): string {
  const entry = CITY_MAP[input] || CITY_MAP[input.toUpperCase()];
  if (entry) return entry.cn;
  return input;
}

/** Tomorrow's date as YYYY-MM-DD */
export function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Shared types ───────────────────────────────────────────────────
export interface FlightResult {
  source: string;
  airline: string;
  flightNo: string;
  depart: string;
  arrive: string;
  duration: string;
  stops: string;
  price: number | string;
}

export interface FlightSource {
  name: string;
  domain: string;
  search: (page: IPage, from: string, to: string, date: string, limit: number) => Promise<FlightResult[]>;
}
