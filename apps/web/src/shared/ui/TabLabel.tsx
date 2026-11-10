import { Badge, Flex } from 'antd';
import type { ReactNode } from 'react';

/** A tab title with an optional neutral count badge ("Documents 3"); no badge for zero. */
export function TabLabel({ label, count }: { label: ReactNode; count?: number | null }) {
  return (
    <Flex gap={6} align="center" component="span">
      {label}
      {count ? <Badge count={count} size="small" className="rm-count-badge" /> : null}
    </Flex>
  );
}
