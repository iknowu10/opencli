/**
 * Booking.com 酒店搜索 — 通过浏览器提取，含价格。
 *
 * Usage:
 *   opencli booking hotel Bangkok --star 5
 *   opencli booking hotel 东京 --checkin 2026-06-01 --checkout 2026-06-03 --limit 10
 *   opencli booking hotel "Osaka Universal Studios" --star 4
 */
import { cli, Strategy } from '@jackwener/opencli/registry';

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function dayAfter(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

cli({
  site: 'booking',
  name: 'hotel',
  description: '酒店搜索（Booking.com，含价格，全球覆盖）',
  domain: 'www.booking.com',
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  timeoutSeconds: 90,
  args: [
    { name: 'query', required: true, positional: true, help: '城市或地点 (如: Bangkok, 东京, "Osaka Universal Studios")' },
    { name: 'checkin', help: '入住日期 YYYY-MM-DD (默认明天)' },
    { name: 'checkout', help: '退房日期 (默认入住后一天)' },
    { name: 'star', type: 'int', default: 0, help: '星级 (3/4/5, 0=不限)' },
    { name: 'currency', default: 'CNY', help: '货币 (CNY/USD/AUD/THB 等)' },
    { name: 'limit', type: 'int', default: 15, help: '显示条数' },
  ],
  columns: ['rank', 'name', 'rating', 'reviews', 'price', 'location'],
  func: async (page, kwargs) => {
    const query = kwargs.query;
    const checkin = kwargs.checkin || tomorrow();
    const checkout = kwargs.checkout || dayAfter(checkin);
    const star = kwargs.star || 0;
    const currency = kwargs.currency || 'CNY';
    const limit = kwargs.limit || 15;

    let url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(query)}&checkin=${checkin}&checkout=${checkout}&group_adults=2&no_rooms=1&selected_currency=${currency}`;
    if (star) url += `&nflt=class%3D${star}`;

    await page.goto(url);
    await page.wait(12);
    try { await page.autoScroll({ times: 4, delayMs: 1000 }); } catch(e) { /* ignore */ }
    await page.wait(3);

    const raw = await page.evaluate(`
      (function() {
        var cards = document.querySelectorAll("[data-testid='property-card']");
        if (cards.length === 0) cards = document.querySelectorAll("[class*='property-card'], [class*='sr_item']");
        var results = [];
        var seen = {};
        for (var i = 0; i < cards.length; i++) {
          var card = cards[i];
          var text = card.innerText || "";
          var lines = text.split("\\n").map(function(s){return s.trim()}).filter(Boolean);
          if (lines.length < 3) continue;

          // Name: first line that's not a badge
          var name = "";
          for (var j = 0; j < Math.min(lines.length, 5); j++) {
            var l = lines[j];
            if (l.length > 3 && l.length < 80 && !/^(Ad|Genius|New|Top|Sold|Limited|Free|Last)/.test(l) && !/^\\d/.test(l)) {
              name = l; break;
            }
          }
          if (!name || seen[name]) continue;
          seen[name] = true;

          var rating = "", reviews = "", price = "", location = "";

          for (var k = 0; k < lines.length; k++) {
            var line = lines[k];
            // Rating: "评分X.X"
            if (/评分[0-9]\\.[0-9]/.test(line)) rating = line.match(/[0-9]\\.[0-9]/)[0];

            // Reviews
            if (/\\d+.*review|\\d+.*条.*评/i.test(line)) reviews = line;

            // Price: "561元" or "3,498元2,624元" (take last number=current price)
            // Also handle "CNY XXX", "$XXX", "¥XXX"
            if (/^价格|^原价/.test(line)) continue; // skip "价格561元" duplicate line
            var priceNums = line.match(/([0-9][0-9,]+)元/g);
            if (priceNums && !price) {
              // Last match is current price (after discount)
              var last = priceNums[priceNums.length - 1];
              price = "¥" + last.replace("元", "");
            }
            if (!price) {
              var intlPrice = line.match(/[A-Z]{3}\\s*[0-9][0-9,]+|\\$[0-9,]+|[¥￥][0-9,]+|€[0-9,]+|£[0-9,]+/);
              if (intlPrice) price = intlPrice[0];
            }

            // Location: line with 地图/千米/km
            if (/显示在地图|千米|公里|km/i.test(line) && !location) {
              location = line.replace(/显示在地图上/g, "").substring(0, 60);
            }
          }

          results.push({name: name, rating: rating, reviews: reviews, price: price, location: location});
        }
        return results;
      })()
    `);

    if (!Array.isArray(raw)) return [];
    return raw.slice(0, limit).map((h, i) => ({
      rank: i + 1,
      name: h.name,
      rating: h.rating ? h.rating + '/10' : '',
      reviews: h.reviews || '',
      price: h.price || '',
      location: h.location || '',
    }));
  },
});
