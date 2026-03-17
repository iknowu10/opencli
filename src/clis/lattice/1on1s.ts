import { cli, Strategy } from '../../registry.js';
import { latticeGQL } from '../../lattice.js';

cli({
  site: 'lattice',
  name: '1on1s',
  description: 'View items written in your 1:1 meetings from Lattice',
  domain: 'latticehq.com',
  strategy: Strategy.COOKIE,
  browser: false,
  args: [
    { name: 'limit', type: 'int' as const, default: 30, help: 'Max items to return' },
    { name: 'meetings', type: 'int' as const, default: 5, help: 'Number of recent meetings to scan' },
  ],
  columns: ['meetingDate', 'with', 'body', 'completed', 'createdBy'],
  func: async (_page, kwargs) => {
    const itemLimit = Number(kwargs.limit) || 30;
    const meetingCount = Number(kwargs.meetings) || 5;

    const result = await latticeGQL(`
      query OneOnOnes($meetingCount: Int) {
        me {
          id
          name
          oneOnOnes {
            id
            manager { id name }
            report { id name }
            meetings(first: $meetingCount) {
              nodes {
                id
                scheduledAt
                agendaItems {
                  id
                  body
                  isCompleted
                  createdBy { name }
                }
              }
            }
          }
        }
      }
    `, { meetingCount });

    const me = result?.data?.me;
    const oneOnOnes: any[] = me?.oneOnOnes ?? [];
    const items: any[] = [];

    for (const oo of oneOnOnes) {
      const other = oo.manager?.id !== me?.id ? oo.manager?.name : oo.report?.name;
      for (const meeting of (oo.meetings?.nodes ?? [])) {
        const meetingDate = (meeting.scheduledAt ?? '').slice(0, 10);
        for (const item of (meeting.agendaItems ?? [])) {
          items.push({
            meetingDate,
            with: other ?? '',
            body: (item.body ?? '').replace(/\n/g, ' ').slice(0, 120),
            completed: item.isCompleted ? 'yes' : 'no',
            createdBy: item.createdBy?.name ?? '',
          });
        }
      }
    }

    return items.slice(0, itemLimit);
  },
});
