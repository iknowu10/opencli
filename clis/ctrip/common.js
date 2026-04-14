/**
 * Shared utilities for ctrip CLI — city codes, date helpers.
 */

const RAW_FLIGHTS = {
  '北京': 'BJS', '上海': 'SHA', '广州': 'CAN', '深圳': 'SZX',
  '成都': 'CTU', '杭州': 'HGH', '重庆': 'CKG', '武汉': 'WUH',
  '西安': 'SIA', '南京': 'NKG', '长沙': 'CSX', '厦门': 'XMN',
  '昆明': 'KMG', '大连': 'DLC', '天津': 'TSN', '青岛': 'TAO',
  '三亚': 'SYX', '海口': 'HAK', '郑州': 'CGO', '福州': 'FOC',
  '合肥': 'HFE', '贵阳': 'KWE', '南宁': 'NNG', '哈尔滨': 'HRB',
  '沈阳': 'SHE', '济南': 'TNA', '乌鲁木齐': 'URC', '兰州': 'LHW',
  '拉萨': 'LXA', '银川': 'INC', '西宁': 'XNN', '呼和浩特': 'HET',
  '石家庄': 'SJW', '太原': 'TYN', '南昌': 'KHN', '珠海': 'ZUH',
  '无锡': 'WUX', '宁波': 'NGB', '温州': 'WNZ', '烟台': 'YNT',
  '香港': 'HKG', '澳门': 'MFM', '台北': 'TPE',
  '东京': 'TYO', '大阪': 'OSA', '首尔': 'SEL', '曼谷': 'BKK',
  '新加坡': 'SIN', '吉隆坡': 'KUL', '伦敦': 'LON', '巴黎': 'PAR',
  '纽约': 'NYC', '洛杉矶': 'LAX', '旧金山': 'SFO', '悉尼': 'SYD',
  '墨尔本': 'MEL', '清迈': 'CNX', '普吉岛': 'HKT', '巴厘岛': 'DPS',
};

// City name → { code, pinyin } for ctrip hotel URLs
const RAW_HOTELS = {
  '北京': { code: 1, py: 'beijing' }, '上海': { code: 2, py: 'shanghai' },
  '广州': { code: 32, py: 'guangzhou' }, '深圳': { code: 26, py: 'shenzhen' },
  '成都': { code: 28, py: 'chengdu' }, '杭州': { code: 14, py: 'hangzhou' },
  '重庆': { code: 4, py: 'chongqing' }, '武汉': { code: 477, py: 'wuhan' },
  '西安': { code: 7, py: 'xian' }, '南京': { code: 9, py: 'nanjing' },
  '长沙': { code: 148, py: 'changsha' }, '厦门': { code: 21, py: 'xiamen' },
  '昆明': { code: 31, py: 'kunming' }, '三亚': { code: 43, py: 'sanya' },
  '海口': { code: 37, py: 'haikou' }, '青岛': { code: 5, py: 'qingdao' },
  '大连': { code: 10, py: 'dalian' }, '天津': { code: 22, py: 'tianjin' },
  '苏州': { code: 11, py: 'suzhou' }, '无锡': { code: 100, py: 'wuxi' },
  '南宁': { code: 166, py: 'nanning' }, '桂林': { code: 28545, py: 'guilin' },
  '丽江': { code: 104, py: 'lijiang' }, '大理': { code: 382, py: 'dali' },
  '拉萨': { code: 36, py: 'lasa' },
  // 国际城市
  '曼谷': { code: 359, py: 'bangkok' }, '东京': { code: 317, py: 'tokyo' },
  '大阪': { code: 293, py: 'osaka' }, '京都': { code: 505, py: 'kyoto' },
  '首尔': { code: 234, py: 'seoul' }, '新加坡': { code: 73, py: 'singapore' },
  '吉隆坡': { code: 171, py: 'kualalumpur' }, '香港': { code: 58, py: 'hongkong' },
  '澳门': { code: 78, py: 'macau' }, '台北': { code: 360, py: 'taipei' },
  '清迈': { code: 192, py: 'chiangmai' }, '普吉岛': { code: 193, py: 'phuket' },
  '巴厘岛': { code: 438, py: 'bali' }, '河内': { code: 3041, py: 'hanoi' },
  '胡志明市': { code: 72, py: 'hochiminh' }, '伦敦': { code: 309, py: 'london' },
  '巴黎': { code: 308, py: 'paris' }, '纽约': { code: 645, py: 'newyork' },
  '洛杉矶': { code: 732, py: 'losangeles' }, '悉尼': { code: 263, py: 'sydney' },
  '墨尔本': { code: 208, py: 'melbourne' },
};

// Build bidirectional flight code lookup
const FLIGHT_MAP = {};
for (const [cn, code] of Object.entries(RAW_FLIGHTS)) {
  FLIGHT_MAP[cn] = { code, cn };
  FLIGHT_MAP[code] = { code, cn };
}

export function toFlightCode(input) {
  const entry = FLIGHT_MAP[input] || FLIGHT_MAP[input.toUpperCase()];
  if (entry) return entry.code;
  if (/^[A-Z]{3}$/i.test(input)) return input.toUpperCase();
  return input;
}

export function toHotelCity(input) {
  const entry = RAW_HOTELS[input];
  if (entry) return entry;
  return null;
}

export function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function dayAfter(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
