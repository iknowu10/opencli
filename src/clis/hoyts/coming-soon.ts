import { cli, Strategy } from '../../registry.js';

cli({
  site: 'hoyts',
  name: 'coming-soon',
  access: 'read',
  description: 'HOYTS coming soon movies',
  domain: 'www.hoyts.com.au',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'limit', type: 'int', default: 20, help: 'Number of movies' },
  ],
  columns: ['title', 'rating', 'runtime', 'genres', 'release'],
  func: async (kwargs) => {
    const { limit } = kwargs;
    const res = await fetch('https://apim.hoyts.com.au/au/cinemaapi/api/movies');
    const movies: any[] = await res.json();
    return movies
      .filter((m: any) => m.type === 'comingSoon')
      .sort((a: any, b: any) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))
      .slice(0, Number(limit))
      .map((m: any) => ({
        title: m.name,
        rating: m.rating?.id ?? '',
        runtime: m.duration + 'min',
        genres: m.genres.join(', '),
        release: m.releaseDate?.substring(0, 10) ?? 'TBA',
      }));
  },
});
