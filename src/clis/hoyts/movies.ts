import { cli, Strategy } from '../../registry.js';

cli({
  site: 'hoyts',
  name: 'movies',
  description: 'HOYTS now showing movies',
  domain: 'www.hoyts.com.au',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'limit', type: 'int', default: 20, help: 'Number of movies' },
  ],
  columns: ['rank', 'title', 'rating', 'runtime', 'genres', 'release'],
  func: async (_page, kwargs) => {
    const { limit } = kwargs;
    const res = await fetch('https://apim.hoyts.com.au/au/cinemaapi/api/movies');
    const movies: any[] = await res.json();
    return movies
      .filter((m: any) => m.nowShowing)
      .sort((a: any, b: any) => (a.ranking ?? 999) - (b.ranking ?? 999))
      .slice(0, Number(limit))
      .map((m: any) => ({
        rank: m.ranking ?? '',
        title: m.name,
        rating: m.rating?.id ?? '',
        runtime: m.duration ? m.duration + 'min' : '',
        genres: m.genres.join(', '),
        release: m.releaseDate.substring(0, 10),
      }));
  },
});
