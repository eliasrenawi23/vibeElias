import { installValidationErrorMap, todayInBusinessTz } from '@renawi/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../app/i18n';
import { jsonResponse, renderWithProviders } from '../../../test/renderWithProviders';
import type { LeaseDetail } from '../types';
import { EndLeaseDialog } from './EndLeaseDialog';

beforeAll(() => installValidationErrorMap());

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

function lease(over: Partial<LeaseDetail> = {}): LeaseDetail {
  return {
    id: 'lc_1',
    contractNo: 1024,
    driverId: 'drv_1',
    type: 'CAR_AND_NUMBER',
    status: 'ACTIVE',
    billingPeriod: 'MONTHLY',
    startDate: '2026-01-01',
    endDate: '2099-12-31',
    actualEndDate: null,
    endReason: null,
    paymentDay: 1,
    rentIncludesVat: true,
    earlyExitPenaltyMonths: 1.5,
    depositAmount: 5000,
    depositKind: 'CASH',
    responsibilities: { insurance: 'DRIVER', test: 'DRIVER', repairs: 'DRIVER', fines: 'DRIVER' },
    terms: null,
    notes: null,
    renewedFromId: null,
    signedAt: null,
    driver: { id: 'drv_1', name: 'Samir Haddad' },
    segments: [],
    currentSegment: {
      id: 'seg_1',
      taxiLicense: { id: 'tl_1', licenseNo: 'T-1001' },
      vehicle: { id: 'veh_1', plateNo: '12345625' },
      monthlyRent: 1333.33,
      startDate: '2026-01-01',
    },
    balance: { charged: 0, paid: 0, credited: 0, balance: 0, depositHeld: 5000 },
    openCharges: [],
    lastPayment: null,
    handoverChecklist: null,
    returnChecklist: null,
    documentCount: 0,
    alerts: [],
    ...over,
  };
}

describe('EndLeaseDialog', () => {
  it('shows the computed early-exit penalty (months x rent) and posts it when applied', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse(lease({ status: 'TERMINATED' })));
    const onSaved = vi.fn();
    renderWithProviders(<EndLeaseDialog lease={lease()} onClose={vi.fn()} onSaved={onSaved} />);

    // 1.5 x 1,333.33 = 1,999.995 -> 2,000.00 (half-up to the agora).
    const penalty = await screen.findByTestId('end-penalty');
    expect(penalty).toHaveTextContent('₪2,000.00');
    expect(penalty).toHaveTextContent(/1\.5.*× the monthly rent of.*₪1,333\.33/);
    expect(penalty).toHaveAttribute('data-applied', 'false');
    // Ending before the end date is an early exit.
    expect(screen.getByText(/The contract ends before its end date/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('end-apply-penalty'));
    expect(screen.getByTestId('end-penalty')).toHaveAttribute('data-applied', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'End contract' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/leases/lc_1/end');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      actualEndDate: todayInBusinessTz(),
      reason: 'TERMINATED_BY_DRIVER',
      applyPenalty: true,
      depositAction: 'HOLD',
      note: null,
    });
    expect(body.returnChecklist).toMatchObject({ date: todayInBusinessTz(), keysReturned: false });
  });

  it('recomputes the penalty from the contract terms', async () => {
    renderWithProviders(
      <EndLeaseDialog
        lease={lease({
          earlyExitPenaltyMonths: 2,
          currentSegment: { ...lease().currentSegment!, monthlyRent: 1450 },
        })}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(await screen.findByTestId('end-penalty')).toHaveTextContent('₪2,900.00');
  });
});
