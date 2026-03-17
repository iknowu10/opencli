import { cli, Strategy } from '../../registry.js';
import { latticeGQL } from '../../lattice.js';

cli({
  site: 'lattice',
  name: 'reviews',
  description: 'List performance review packets from Lattice',
  domain: 'latticehq.com',
  strategy: Strategy.COOKIE,
  browser: false,
  args: [
    { name: 'limit', type: 'int' as const, default: 20, help: 'Number of results' },
  ],
  columns: ['id', 'cycle', 'cycleStatus', 'dueDate', 'reviewee', 'status', 'submittedAt'],
  func: async (_page, kwargs) => {
    const result = await latticeGQL(`
      query Reviews {
        me {
          reviewPackets {
            id
            status
            submittedAt
            reviewee { id name }
            reviewCycle { id name status dueDate }
          }
        }
      }
    `);

    const packets: any[] = result?.data?.me?.reviewPackets ?? [];
    return packets.slice(0, Number(kwargs.limit) || 20).map((p: any) => ({
      id: p.id ?? '',
      cycle: p.reviewCycle?.name ?? '',
      cycleStatus: p.reviewCycle?.status ?? '',
      dueDate: (p.reviewCycle?.dueDate ?? '').slice(0, 10),
      reviewee: p.reviewee?.name ?? '',
      status: p.status ?? '',
      submittedAt: (p.submittedAt ?? '').slice(0, 10),
    }));
  },
});
