import { Flex, Radio, Typography } from 'antd';
import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';

export interface SelectableItem {
  value: string;
  /** Main line (part of the radio's accessible name). */
  title: ReactNode;
  /** Secondary details under the title. */
  description?: ReactNode;
  /** Tags / badges on the trailing side. */
  extra?: ReactNode;
  disabled?: boolean;
}

export interface SelectableListProps {
  items: readonly SelectableItem[];
  value: string | null | undefined;
  onChange: (value: string) => void;
  /** Accessible name of the radio group. */
  label: string;
  /** Shown instead of the list when there are no items. */
  empty?: ReactNode;
  invalid?: boolean;
  'data-testid'?: string;
}

/** A single choice among rich rows (licences, cars...) as a bordered radio list. */
export function SelectableList({
  items,
  value,
  onChange,
  label,
  empty,
  invalid,
  'data-testid': testId,
}: SelectableListProps) {
  if (items.length === 0) return <>{empty ?? <EmptyState compact />}</>;
  const groupClass = ['rm-selectable-list', invalid ? 'rm-selectable-list-invalid' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <Radio.Group
      value={value ?? null}
      onChange={(e) => onChange(String(e.target.value))}
      aria-label={label}
      className={groupClass}
      data-testid={testId}
    >
      <Flex vertical gap={8}>
        {items.map((item) => (
          <Radio
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={
              value === item.value
                ? 'rm-selectable-item rm-selectable-item-selected'
                : 'rm-selectable-item'
            }
            data-value={item.value}
          >
            <Flex justify="space-between" align="center" gap={12} wrap>
              <Flex vertical gap={2}>
                <span className="rm-selectable-title">{item.title}</span>
                {item.description && (
                  <Typography.Text type="secondary" className="rm-selectable-desc">
                    {item.description}
                  </Typography.Text>
                )}
              </Flex>
              {item.extra && (
                <Flex gap={4} wrap align="center">
                  {item.extra}
                </Flex>
              )}
            </Flex>
          </Radio>
        ))}
      </Flex>
    </Radio.Group>
  );
}
