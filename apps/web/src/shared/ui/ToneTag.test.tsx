import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../app/i18n';
import { renderWithProviders } from '../../test/renderWithProviders';
import { AlertTags } from './AlertTags';
import { StatusTag } from './StatusTag';
import { ToneTag } from './ToneTag';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

describe('ToneTag', () => {
  it('paints the tag with the tone classes and keeps extra classes', () => {
    renderWithProviders(
      <ToneTag tone="purple" className="extra" data-testid="tag">
        Consigned
      </ToneTag>,
    );
    const tag = screen.getByTestId('tag');
    expect(tag).toHaveClass('ant-tag', 'rm-tone', 'rm-tone-purple', 'extra');
    expect(tag).toHaveAttribute('data-tone', 'purple');
    expect(tag).toHaveTextContent('Consigned');
  });
});

describe('StatusTag', () => {
  it('shows the translated label in the tone of that enum value', () => {
    renderWithProviders(<StatusTag enumName="LeaseStatus" value="TERMINATED" data-testid="s" />);
    const tag = screen.getByTestId('s');
    expect(tag).toHaveClass('rm-status-tag', 'rm-tone', 'rm-tone-error');
    expect(tag).toHaveAttribute('data-status', 'TERMINATED');
    expect(tag).toHaveTextContent(i18n.t('enums.LeaseStatus.TERMINATED'));
  });

  it('reads the tone per enum', () => {
    renderWithProviders(
      <>
        <StatusTag enumName="DealStatus" value="CANCELLED" data-testid="deal" />
        <StatusTag enumName="FineStatus" value="PAID_BY_US" data-testid="fine" />
        <StatusTag enumName="VehicleStatus" value="LEASED" data-testid="car" />
      </>,
    );
    expect(screen.getByTestId('deal')).toHaveClass('rm-tone-neutral');
    expect(screen.getByTestId('fine')).toHaveClass('rm-tone-purple');
    expect(screen.getByTestId('car')).toHaveClass('rm-tone-accent');
  });
});

describe('AlertTags', () => {
  it('shows known codes in their tone and unknown ones as neutral "needs attention"', () => {
    renderWithProviders(<AlertTags enumName="LeaseAlert" alerts={['overdue', 'fromTheFuture']} />);
    const overdue = document.querySelector('[data-alert="overdue"]');
    const unknown = document.querySelector('[data-alert="fromTheFuture"]');
    expect(overdue).toHaveClass('rm-tone-error');
    expect(overdue).toHaveTextContent(i18n.t('leases.alerts.overdue'));
    expect(unknown).toHaveClass('rm-tone-neutral');
    expect(unknown).toHaveTextContent(i18n.t('vehicles.alerts.unknown'));
  });

  it('renders a dash, or nothing with hideEmpty, without alerts', () => {
    const dash = renderWithProviders(<AlertTags enumName="DealAlert" alerts={[]} />);
    expect(dash.container).toHaveTextContent('—');
    dash.unmount();
    const hidden = renderWithProviders(<AlertTags enumName="DealAlert" alerts={null} hideEmpty />);
    expect(hidden.container.querySelector('.rm-alert-badges')).toBeNull();
    expect(hidden.container).not.toHaveTextContent('—');
  });
});
