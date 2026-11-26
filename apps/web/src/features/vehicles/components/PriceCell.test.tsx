import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../../app/i18n';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { PriceCell } from './VehicleInventoryTab';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

describe('PriceCell', () => {
  it('shows the taxi price and the estimated price as private for a taxi', () => {
    const { container } = renderWithProviders(
      <PriceCell vehicle={{ isTaxi: true, listingPrice: 35000, privatePriceEstimate: 50000 }} />,
    );
    expect(container).toHaveTextContent('₪35,000');
    expect(screen.getByTestId('private-estimate')).toHaveTextContent('as private: ₪50,000');
  });

  it('shows only the price when there is no estimate or the car is not a taxi', () => {
    const { container } = renderWithProviders(
      <>
        <PriceCell vehicle={{ isTaxi: true, listingPrice: 35000, privatePriceEstimate: null }} />
        <PriceCell vehicle={{ isTaxi: false, listingPrice: 60000, privatePriceEstimate: null }} />
      </>,
    );
    expect(screen.queryByTestId('private-estimate')).toBeNull();
    expect(container).toHaveTextContent('₪35,000');
    expect(container).toHaveTextContent('₪60,000');
  });
});
