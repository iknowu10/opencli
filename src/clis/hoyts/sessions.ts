import { cli, Strategy } from '../../registry.js';

cli({
  site: 'hoyts',
  name: 'sessions',
  description: 'HOYTS session times for a cinema',
  domain: 'www.hoyts.com.au',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'cinema', required: true, help: 'Cinema slug or ID (e.g. chatswood-westfield or CWFFLD)' },
    { name: 'date', default: '', help: 'Date in YYYY-MM-DD format (default: today)' },
    { name: 'movie', default: '', help: 'Filter by movie name (partial match)' },
  ],
  columns: ['time', 'movie', 'type', 'screen', 'format'],
  func: async (_page, kwargs) => {
    const { cinema, date: dateArg, movie: movieFilter } = kwargs;
    const date = dateArg || new Date().toISOString().slice(0, 10);

    const cinemasRes = await fetch('https://apim.hoyts.com.au/au/cinemaapi/api/cinemas');
    const cinemas: any[] = await cinemasRes.json();
    const found = cinemas.find((c: any) =>
      c.id === cinema.toUpperCase() || c.slug === cinema.toLowerCase()
    );
    if (!found) throw new Error(`Cinema not found: "${cinema}". Run "opencli hoyts cinemas" to list all.`);

    const [moviesRes, sessionsRes] = await Promise.all([
      fetch('https://apim.hoyts.com.au/au/cinemaapi/api/movies'),
      fetch(`https://apim.hoyts.com.au/au/cinemaapi/api/sessions?date=${date}&cinemaId=${found.id}`),
    ]);
    const movies: any[] = await moviesRes.json();
    const sessions: any[] = await sessionsRes.json();

    const movieMap = new Map(movies.map((m: any) => [m.vistaId, m.name]));
    const cinemaSessions = sessions.filter((s: any) =>
      s.cinemaId === found.id && s.date.startsWith(date)
    );

    const filtered = movieFilter
      ? cinemaSessions.filter((s: any) =>
          (movieMap.get(s.movieId) ?? '').toLowerCase().includes(String(movieFilter).toLowerCase())
        )
      : cinemaSessions;

    const displayTags = new Set(['XTREME', 'IMAX', 'LUX', 'DBOX', 'SCREENX', 'ATMOS', '3D', 'ONYX', 'RC', 'DAYBEDS', 'LOUNGE']);

    return filtered
      .map((s: any) => ({
        time: s.date.substring(11, 16),
        movie: movieMap.get(s.movieId) ?? s.movieId,
        type: s.typeId,
        screen: s.screenName,
        format: s.originalTags.filter((t: string) => displayTags.has(t)).map((t: string) => t === 'RC' ? 'Recliners' : t === 'DAYBEDS' ? 'Daybeds' : t === 'LOUNGE' ? 'Lounge' : t).join(', ') || 'Standard',
      }))
      .sort((a: any, b: any) => a.time.localeCompare(b.time));
  },
});
