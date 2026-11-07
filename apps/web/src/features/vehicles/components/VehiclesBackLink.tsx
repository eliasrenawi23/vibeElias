import { ArrowLeftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

/** "Back to the list" link to `/vehicles`. */
export function VehiclesBackLink() {
  const { t } = useTranslation();
  return (
    <Link to="/vehicles" className="rm-back-link">
      <ArrowLeftOutlined className="rm-flip-rtl" /> {t('common.backToList')}
    </Link>
  );
}
