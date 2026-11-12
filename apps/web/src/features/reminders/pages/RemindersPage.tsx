import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { FeedTab } from '../components/FeedTab';
import { ManualRemindersTab } from '../components/ManualRemindersTab';

type RemindersTab = 'feed' | 'manual';

/** `/reminders`: every expiry and deadline (`?tab=` default) and the manual reminders. */
export function RemindersPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab: RemindersTab = params.get('tab') === 'manual' ? 'manual' : 'feed';

  return (
    <Tabs
      activeKey={tab}
      // Each tab has its own filters: switching starts from a clean URL.
      onChange={(key) => setParams(key === 'manual' ? { tab: key } : {}, { replace: true })}
      destroyOnHidden
      items={[
        { key: 'feed', label: t('reminders.tabs.feed'), children: <FeedTab /> },
        { key: 'manual', label: t('reminders.tabs.manual'), children: <ManualRemindersTab /> },
      ]}
    />
  );
}
