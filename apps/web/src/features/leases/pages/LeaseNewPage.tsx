import { useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Flex, Result } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '../../../shared/ui/PageBreadcrumbs';
import { driverKeys } from '../../drivers/queryKeys';
import { taxiLicenseKeys } from '../../taxi-licenses/queryKeys';
import { vehicleKeys } from '../../vehicles/queryKeys';
import { ContractNo } from '../components/ContractNo';
import { ActivateDialog } from '../dialogs/ActivateDialog';
import { leasePath } from '../lib/leaseRules';
import { leaseKeys } from '../queryKeys';
import type { LeaseDetail } from '../types';
import { LeaseWizard } from '../wizard/LeaseWizard';

/**
 * `/leases/new` (optionally `?driverId=`): the lease wizard. The DRAFT it creates can be
 * activated right away (signed date + deposit received) or later from the lease page.
 */
export function LeaseNewPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [created, setCreated] = useState<LeaseDetail | null>(null);
  const [activating, setActivating] = useState(false);

  const refresh = () => {
    for (const key of [leaseKeys.all, driverKeys.all, taxiLicenseKeys.all, vehicleKeys.all]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  return (
    <Flex vertical gap={16}>
      <PageBreadcrumbs
        items={[{ title: t('nav.leases'), to: '/leases' }, { title: t('leases.newTitle') }]}
      />
      {created ? (
        <Card variant="borderless">
          <Result
            status="success"
            title={
              <span>
                {t('leases.wizard.created')} <ContractNo no={created.contractNo} />
              </span>
            }
            subTitle={t('leases.wizard.createdHint')}
            extra={[
              <Button
                key="activate"
                type="primary"
                onClick={() => setActivating(true)}
                data-testid="wizard-activate"
              >
                {t('leases.activate.now')}
              </Button>,
              <Button
                key="open"
                onClick={() => navigate(leasePath(created.id))}
                data-testid="wizard-open"
              >
                {t('leases.wizard.openContract')}
              </Button>,
            ]}
          />
        </Card>
      ) : (
        <LeaseWizard
          initialDriverId={params.get('driverId')}
          onCreated={(lease) => {
            setCreated(lease);
            queryClient.setQueryData(leaseKeys.detail(lease.id), lease);
            refresh();
            void message.success(t('leases.wizard.created'));
          }}
          onCancel={() => navigate('/leases')}
        />
      )}
      {created && activating && (
        <ActivateDialog
          lease={created}
          onClose={() => setActivating(false)}
          onSaved={(lease) => {
            setActivating(false);
            queryClient.setQueryData(leaseKeys.detail(lease.id), lease);
            refresh();
            void message.success(t('leases.activate.done'));
            navigate(leasePath(lease.id), { replace: true });
          }}
        />
      )}
    </Flex>
  );
}
