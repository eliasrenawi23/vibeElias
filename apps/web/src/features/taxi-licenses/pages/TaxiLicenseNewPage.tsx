import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Flex } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { PageBreadcrumbs } from '../../../shared/ui/PageBreadcrumbs';
import { createTaxiLicense } from '../api';
import { TaxiLicenseForm } from '../forms/TaxiLicenseForm';
import { licensePath } from '../lib/licenseRules';
import { taxiLicenseKeys } from '../queryKeys';

/** `/taxi-licenses/new`: create a licence, then open its page. */
export function TaxiLicenseNewPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: createTaxiLicense,
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: taxiLicenseKeys.all });
      void message.success(t('taxiLicenses.created'));
      navigate(licensePath(created.id), { replace: true });
    },
  });
  return (
    <Flex vertical gap={16}>
      <PageBreadcrumbs
        items={[
          { title: t('nav.taxiLicenses'), to: '/taxi-licenses' },
          { title: t('taxiLicenses.newTitle') },
        ]}
      />
      <TaxiLicenseForm
        onSubmit={(values) => mutation.mutateAsync(values)}
        submitting={mutation.isPending}
        onCancel={() => navigate('/taxi-licenses')}
        submitLabel={t('actions.create')}
      />
    </Flex>
  );
}
