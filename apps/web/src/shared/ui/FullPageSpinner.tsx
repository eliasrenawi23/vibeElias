import { Flex, Spin } from 'antd';
import { useTranslation } from 'react-i18next';

export function FullPageSpinner() {
  const { t } = useTranslation();
  return (
    <Flex className="rm-full-page" align="center" justify="center" role="status">
      <Spin size="large" description={t('common.loading')} />
    </Flex>
  );
}
