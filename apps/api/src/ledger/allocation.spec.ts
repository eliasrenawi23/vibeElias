import { allocateFifo, FifoCharge, FifoPayment } from './allocation';

const charge = (id: string, amount: number, dueDate: string, date = dueDate): FifoCharge => ({
  id,
  amount,
  date,
  dueDate,
});
const pay = (id: string, amount: number, date: string, allocateTo?: string[]): FifoPayment => ({
  id,
  amount,
  date,
  allocateTo,
});

describe('allocateFifo', () => {
  it('settles the oldest due charges first, payments in date order', () => {
    const rows = allocateFifo(
      [
        charge('nov', 6500, '2026-11-10', '2026-11-01'),
        charge('oct', 6500, '2026-10-10', '2026-10-01'),
        charge('aug', 3354.84, '2026-08-16'),
      ],
      [
        pay('p2', 6500, '2026-09-09'),
        pay('p1', 3354.84, '2026-08-16'),
        pay('p3', 2500, '2026-10-12'),
      ],
    );
    expect(rows).toEqual([
      { paymentId: 'p1', chargeId: 'aug', amount: 3354.84 },
      { paymentId: 'p2', chargeId: 'oct', amount: 6500 },
      { paymentId: 'p3', chargeId: 'nov', amount: 2500 },
    ]);
  });

  it('splits a payment over several charges and leaves the excess unallocated', () => {
    const rows = allocateFifo(
      [charge('a', 100, '2026-01-10'), charge('b', 50.5, '2026-02-10')],
      [pay('p', 200, '2026-01-01')],
    );
    expect(rows).toEqual([
      { paymentId: 'p', chargeId: 'a', amount: 100 },
      { paymentId: 'p', chargeId: 'b', amount: 50.5 },
    ]);
  });

  it('uses the charge date when there is no due date and breaks ties by id', () => {
    const rows = allocateFifo(
      [
        { id: 'z', amount: 10, date: '2026-01-05', dueDate: null },
        { id: 'y', amount: 10, date: '2026-01-05', dueDate: null },
        { id: 'x', amount: 10, date: '2026-01-01', dueDate: '2026-01-20' },
      ],
      [pay('p', 25, '2026-01-02')],
    );
    expect(rows).toEqual([
      { paymentId: 'p', chargeId: 'y', amount: 10 },
      { paymentId: 'p', chargeId: 'z', amount: 10 },
      { paymentId: 'p', chargeId: 'x', amount: 5 },
    ]);
  });

  it('honours explicit allocateTo targets before FIFO', () => {
    const rows = allocateFifo(
      [charge('old', 100, '2026-01-10'), charge('fine', 250, '2026-03-01')],
      [pay('p', 300, '2026-03-02', ['fine', 'unknown'])],
    );
    expect(rows).toEqual([
      { paymentId: 'p', chargeId: 'fine', amount: 250 },
      { paymentId: 'p', chargeId: 'old', amount: 50 },
    ]);
  });

  it('is exact to the agora (no float drift)', () => {
    const rows = allocateFifo(
      [charge('a', 0.1, '2026-01-01'), charge('b', 0.2, '2026-01-02')],
      [pay('p1', 0.15, '2026-01-01'), pay('p2', 0.15, '2026-01-02')],
    );
    expect(rows).toEqual([
      { paymentId: 'p1', chargeId: 'a', amount: 0.1 },
      { paymentId: 'p1', chargeId: 'b', amount: 0.05 },
      { paymentId: 'p2', chargeId: 'b', amount: 0.15 },
    ]);
  });
});
