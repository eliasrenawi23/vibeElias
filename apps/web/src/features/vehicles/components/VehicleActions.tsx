import {
  DashboardOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  RollbackOutlined,
  SolutionOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Grid } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { canConsign, returnableCycle } from '../lib/vehicleRules';
import type { VehicleDetail } from '../types';

export type VehicleActionKey = 'edit' | 'status' | 'consign' | 'return' | 'expense' | 'odometer';

export interface VehicleActionsProps {
  vehicle: VehicleDetail;
  onAction: (key: VehicleActionKey) => void;
}

interface ActionDef {
  key: VehicleActionKey;
  label: string;
  icon: ReactNode;
}

/**
 * Actions of the vehicle page header. From `md` up they are buttons; on phones they collapse
 * into one "more" dropdown. Consign / return appear only when the cycle state allows them.
 */
export function VehicleActions({ vehicle, onAction }: VehicleActionsProps) {
  const { t } = useTranslation();
  const screens = Grid.useBreakpoint();
  // `screens` is empty until the first measurement; treat that as desktop.
  const isMobile = screens.md === false;

  const actions: ActionDef[] = [
    { key: 'edit', label: t('actions.edit'), icon: <EditOutlined /> },
    { key: 'status', label: t('vehicles.actions.changeStatus'), icon: <SwapOutlined /> },
    ...(canConsign(vehicle)
      ? [
          {
            key: 'consign' as const,
            label: t('vehicles.actions.consign'),
            icon: <SolutionOutlined />,
          },
        ]
      : []),
    ...(returnableCycle(vehicle)
      ? [
          {
            key: 'return' as const,
            label: t('vehicles.actions.returnToConsignor'),
            icon: <RollbackOutlined className="rm-flip-rtl" />,
          },
        ]
      : []),
    { key: 'expense', label: t('vehicles.actions.addExpense'), icon: <PlusOutlined /> },
    { key: 'odometer', label: t('vehicles.actions.addOdometer'), icon: <DashboardOutlined /> },
  ];

  if (isMobile) {
    return (
      <Dropdown
        trigger={['click']}
        menu={{
          items: actions.map((a) => ({ key: a.key, label: a.label, icon: a.icon })),
          onClick: ({ key }) => onAction(key as VehicleActionKey),
        }}
      >
        <Button
          icon={<MoreOutlined />}
          aria-label={t('vehicles.actions.menu')}
          data-testid="vehicle-actions-menu"
        >
          {t('actions.more')}
        </Button>
      </Dropdown>
    );
  }

  return (
    <>
      {actions.map((a) => (
        <Button
          key={a.key}
          icon={a.icon}
          onClick={() => onAction(a.key)}
          data-testid={`vehicle-action-${a.key}`}
        >
          {a.label}
        </Button>
      ))}
    </>
  );
}
