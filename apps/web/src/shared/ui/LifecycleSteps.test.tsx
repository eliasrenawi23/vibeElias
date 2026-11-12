import { act, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../app/i18n';
import { renderWithProviders } from '../../test/renderWithProviders';
import { LIFECYCLES, lifecycleSteps } from '../lib/lifecycles';
import { LifecycleSteps } from './LifecycleSteps';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

const states = (steps: { status: string; state: string }[]) =>
  steps.map((s) => `${s.status}:${s.state}`);

describe('lifecycleSteps', () => {
  it('marks done, current and waiting steps', () => {
    expect(states(lifecycleSteps(LIFECYCLES.lease, 'DRAFT'))).toEqual([
      'DRAFT:process',
      'ACTIVE:wait',
      'ENDED:wait',
    ]);
    expect(states(lifecycleSteps(LIFECYCLES.lease, 'ACTIVE'))).toEqual([
      'DRAFT:finish',
      'ACTIVE:process',
      'ENDED:wait',
    ]);
    // The last step is finished, not in progress.
    expect(states(lifecycleSteps(LIFECYCLES.deal, 'COMPLETED'))).toEqual([
      'DRAFT:finish',
      'PENDING:finish',
      'COMPLETED:finish',
    ]);
    expect(lifecycleSteps(LIFECYCLES.deal, 'COMPLETED').map((s) => s.current)).toEqual([
      false,
      false,
      true,
    ]);
    expect(states(lifecycleSteps(LIFECYCLES.transfer, 'IN_PROGRESS'))).toEqual([
      'NOT_STARTED:finish',
      'IN_PROGRESS:process',
      'DONE:wait',
    ]);
  });

  it('replaces the remaining steps with an off-path error step', () => {
    expect(states(lifecycleSteps(LIFECYCLES.lease, 'TERMINATED'))).toEqual([
      'DRAFT:finish',
      'ACTIVE:finish',
      'TERMINATED:error',
    ]);
    expect(states(lifecycleSteps(LIFECYCLES.deal, 'CANCELLED'))).toEqual([
      'DRAFT:finish',
      'CANCELLED:error',
    ]);
    // When the page knows the step it was cancelled from.
    expect(states(lifecycleSteps(LIFECYCLES.deal, 'CANCELLED', 'PENDING'))).toEqual([
      'DRAFT:finish',
      'PENDING:finish',
      'CANCELLED:error',
    ]);
    expect(lifecycleSteps(LIFECYCLES.deal, 'CANCELLED').at(-1)?.current).toBe(true);
  });

  it('follows the branch a fine took', () => {
    expect(states(lifecycleSteps(LIFECYCLES.fine, 'NEW'))).toEqual([
      'NEW:process',
      'REASSIGN_SUBMITTED:wait',
      'REASSIGNED:wait',
    ]);
    expect(states(lifecycleSteps(LIFECYCLES.fine, 'REASSIGNED'))).toEqual([
      'NEW:finish',
      'REASSIGN_SUBMITTED:finish',
      'REASSIGNED:finish',
    ]);
    expect(states(lifecycleSteps(LIFECYCLES.fine, 'PAID_BY_US'))).toEqual([
      'NEW:finish',
      'PAID_BY_US:finish',
    ]);
    expect(states(lifecycleSteps(LIFECYCLES.fine, 'CANCELLED'))).toEqual([
      'NEW:finish',
      'CANCELLED:error',
    ]);
  });
});

describe('LifecycleSteps', () => {
  it('renders translated steps with the current one marked and pulsing', () => {
    renderWithProviders(<LifecycleSteps lifecycle="lease" status="ACTIVE" />);
    const group = screen.getByRole('group', { name: 'Contract progress' });
    const titles = within(group)
      .getAllByText(/Draft|Active|Ended/)
      .map((el) => el.closest('[data-lifecycle-step]'));
    expect(titles.map((el) => el?.getAttribute('data-lifecycle-state'))).toEqual([
      'finish',
      'process',
      'wait',
    ]);
    const current = group.querySelector('[aria-current="step"]');
    expect(current).toHaveAttribute('data-lifecycle-step', 'ACTIVE');
    expect(current).toHaveTextContent('Active (current step)');
    expect(group.querySelector('.rm-lifecycle-pulse')).not.toBeNull();
    expect(group.querySelectorAll('.ant-steps-item-finish')).toHaveLength(1);
    expect(group.querySelectorAll('.ant-steps-item-process')).toHaveLength(1);
    expect(group.querySelectorAll('.ant-steps-item-wait')).toHaveLength(1);
  });

  it('shows a terminated contract as an error step without the remaining ones', () => {
    renderWithProviders(<LifecycleSteps lifecycle="lease" status="TERMINATED" />);
    const group = screen.getByTestId('lifecycle-lease');
    expect(group.querySelectorAll('.ant-steps-item')).toHaveLength(3);
    expect(group.querySelectorAll('.ant-steps-item-error')).toHaveLength(1);
    expect(within(group).queryByText('Ended')).toBeNull();
    // An error step does not pulse.
    expect(group.querySelector('.rm-lifecycle-pulse')).toBeNull();
    expect(group.querySelector('[aria-current="step"]')).toHaveAttribute(
      'data-lifecycle-step',
      'TERMINATED',
    );
  });
});
