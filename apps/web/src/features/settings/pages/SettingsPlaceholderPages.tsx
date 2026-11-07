import { PlaceholderPage } from '../../../shared/ui/PlaceholderPage';

/** `/settings/contracts`: default lease terms and clauses (milestone 3). */
export function ContractSettingsPage() {
  return <PlaceholderPage descriptionKey="placeholder.settingsContracts" milestone={3} />;
}

/** `/settings/reminders`: reminder lead days (milestone 5). */
export function ReminderSettingsPage() {
  return <PlaceholderPage descriptionKey="placeholder.settingsReminders" milestone={5} />;
}

/** `/settings/backup`: backup status (milestone 7). */
export function BackupSettingsPage() {
  return <PlaceholderPage descriptionKey="placeholder.settingsBackup" milestone={7} />;
}
