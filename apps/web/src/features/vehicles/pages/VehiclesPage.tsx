import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { BusinessInsuranceTab } from '../components/BusinessInsuranceTab';
import { VehicleInventoryTab } from '../components/VehicleInventoryTab';

type VehiclesTab = 'inventory' | 'insurance';

/** `/vehicles`: inventory list and business-level insurance (`?tab=insurance`). */
export function VehiclesPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab: VehiclesTab = params.get('tab') === 'insurance' ? 'insurance' : 'inventory';

  return (
    <Tabs
      activeKey={tab}
      // Each tab has its own filters: switching starts from a clean URL.
      onChange={(key) => setParams(key === 'insurance' ? { tab: key } : {}, { replace: true })}
      destroyOnHidden
      items={[
        { key: 'inventory', label: t('vehicles.tabs.inventory'), children: <VehicleInventoryTab /> },
        {
          key: 'insurance',
          label: t('vehicles.tabs.businessInsurance'),
          children: <BusinessInsuranceTab />,
        },
      ]}
    />
  );
}
