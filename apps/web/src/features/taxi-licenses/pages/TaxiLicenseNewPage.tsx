import { ArrowLeftOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Flex } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { createTaxiLicense } from '../api';
import { TaxiLicenseForm } from '../forms/TaxiLicenseForm';
import { licensePath } from '../lib/licenseRules';
import { taxiLicenseKeys } from '../queryKeys';

export function LicensesBackLink() {
  const { t } = useTranslation();
  return (
    <Link to="/taxi-licenses" className="rm-back-link">
      <ArrowLeftOutlined className="rm-flip-rtl" /> {t('common.backToList')}
    </Link>
  );
}

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
      <LicensesBackLink />
      <TaxiLicenseForm
        onSubmit={(values) => mutation.mutateAsync(values)}
        submitting={mutation.isPending}
        onCancel={() => navigate('/taxi-licenses')}
        submitLabel={t('actions.create')}
      />
    </Flex>
  );
}
