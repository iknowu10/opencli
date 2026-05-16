import { cli, Strategy } from '../../registry.js';

// ClientBillingInvoiceState: ARCHIVED, DELETED, ISSUED, VOIDED
// InvoicePaymentState: PAID, PARTIALLY_PAID, UNPAID
const STATE_MAP: Record<string, string> = {
  issued: 'ISSUED',
  archived: 'ARCHIVED',
  voided: 'VOIDED',
  deleted: 'DELETED',
};

cli({
  site: 'ignition',
  name: 'invoices',
  access: 'read',
  description: 'List Ignition client invoices',
  domain: 'go.ignitionapp.com',
  strategy: Strategy.INTERCEPT,
  browser: true,
  args: [
    {
      name: 'state',
      default: 'issued',
      help: 'Filter by invoice state: issued, archived, voided (default: issued)',
    },
    {
      name: 'payment',
      default: 'all',
      help: 'Filter by payment state: all, paid, partially_paid, unpaid',
    },
    { name: 'limit', type: 'int', default: 50, help: 'Number of invoices to return' },
  ],
  columns: ['id', 'ref', 'client', 'amount', 'amount_due', 'state', 'payment_state', 'date', 'due'],
  func: async (page, kwargs) => {
    const limit = Number(kwargs.limit) || 50;
    const stateFilter = (kwargs.state || 'issued').toLowerCase();
    const paymentFilter = (kwargs.payment || 'all').toLowerCase();

    await page.goto('https://go.ignitionapp.com/dashboard');
    await page.wait(2);

    // Install interceptor then navigate to billing page
    await page.installInterceptor('graphql');
    await page.goto('https://go.ignitionapp.com/billing');
    await page.wait(4);

    const allRequests = await page.getInterceptedRequests();

    // Find requests that returned invoice data
    const results: any[] = [];

    for (const req of allRequests) {
      if (!req.data) continue;

      // Invoices are nested under client nodes
      const clientNodes: any[] =
        req.data?.data?.clients?.nodes ??
        req.data?.data?.client?.invoices?.nodes ??
        [];

      for (const clientNode of clientNodes) {
        const invoiceNodes: any[] = clientNode?.invoices?.nodes ?? [];
        for (const inv of invoiceNodes) {
          if (results.length >= limit) break;
          const invState = (inv.state ?? '').toLowerCase();
          const invPayment = (inv.paymentState ?? '').toLowerCase();
          if (stateFilter !== 'all' && invState !== stateFilter) continue;
          if (paymentFilter !== 'all' && invPayment !== paymentFilter.replace('_', '_')) continue;

          results.push({
            id: inv.id,
            ref: inv.reference ?? '',
            client: clientNode.name ?? inv.client?.name ?? '',
            amount: inv.amount?.format ?? '',
            amount_due: inv.amountDue?.format ?? '',
            state: invState,
            payment_state: invPayment,
            date: (inv.date ?? '').slice(0, 10),
            due: (inv.dueDate ?? '').slice(0, 10),
          });
        }
        if (results.length >= limit) break;
      }

      // Also handle direct invoice arrays
      const directInvoices: any[] =
        req.data?.data?.invoices?.nodes ??
        (Array.isArray(req.data?.data?.invoices) ? req.data?.data?.invoices : []);

      for (const inv of directInvoices) {
        if (results.length >= limit) break;
        const invState = (inv.state ?? '').toLowerCase();
        const invPayment = (inv.paymentState ?? '').toLowerCase();
        if (stateFilter !== 'all' && invState !== stateFilter) continue;
        if (paymentFilter !== 'all' && invPayment !== paymentFilter) continue;

        results.push({
          id: inv.id,
          ref: inv.reference ?? '',
          client: inv.client?.name ?? '',
          amount: inv.amount?.format ?? '',
          amount_due: inv.amountDue?.format ?? '',
          state: invState,
          payment_state: invPayment,
          date: (inv.date ?? '').slice(0, 10),
          due: (inv.dueDate ?? '').slice(0, 10),
        });
      }

      if (results.length >= limit) break;
    }

    return results;
  },
});
