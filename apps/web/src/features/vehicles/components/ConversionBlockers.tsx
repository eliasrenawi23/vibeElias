import { Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useDynamicT } from '../../../shared/lib/i18n';
import type { VehicleDetail } from '../types';

/**
 * Why a taxi cannot be converted yet: the translated `canConvert.blockers` of the vehicle file,
 * with a link to the taxi licence when it is still registered on the car.
 */
export function ConversionBlockers({ vehicle }: { vehicle: VehicleDetail }) {
  const { t } = useTranslation();
  const dynamicT = useDynamicT();
  const blockers = vehicle.canConvert?.blockers ?? [];
  if (blockers.length === 0) return null;
  return (
    <Alert
      type="warning"
      showIcon
      data-testid="convert-blockers"
      title={t('vehicles.convert.blocked')}
      description={
        <ul className="rm-plain-list">
          {blockers.map((key) => (
            <li key={key}>
              {dynamicT(key, 'validation.invalidValue')}
              {key === 'errors.licenseStillRegistered' && vehicle.registeredLicense && (
                <>
                  {' '}
                  <Link
                    to={`/taxi-licenses/${encodeURIComponent(vehicle.registeredLicense.id)}`}
                    data-testid="convert-license-link"
                  >
                    {t('vehicles.convert.openLicense')}
                  </Link>
                </>
              )}
            </li>
          ))}
        </ul>
      }
    />
  );
}
