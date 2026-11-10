import type { ContactTag } from '@renawi/shared';
import { Flex } from 'antd';
import { StatusTag } from '../../../shared/ui/StatusTag';

/** A contact's tags as translated chips in their tones (`shared/lib/statusTones.ts`). */
export function ContactTags({ tags }: { tags: readonly ContactTag[] }) {
  if (tags.length === 0) return <span className="rm-empty-value">—</span>;
  return (
    <Flex gap={4} wrap>
      {tags.map((tag) => (
        <StatusTag key={tag} enumName="ContactTag" value={tag} className="rm-contact-tag" />
      ))}
    </Flex>
  );
}
