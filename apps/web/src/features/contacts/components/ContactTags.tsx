import type { ContactTag } from '@renawi/shared';
import { Flex, Tag } from 'antd';
import { useEnumLabel } from '../../../shared/lib/enums';

/** AntD preset colour per contact tag. */
export const CONTACT_TAG_COLORS: Readonly<Record<ContactTag, string>> = {
  BUYER: 'blue',
  SELLER: 'purple',
  DRIVER: 'gold',
  LEAD: 'cyan',
  SUPPLIER: 'geekblue',
  GARAGE: 'orange',
  INSURER: 'green',
  CONSIGNOR: 'magenta',
};

/** A contact's tags as coloured, translated chips. */
export function ContactTags({ tags }: { tags: readonly ContactTag[] }) {
  const label = useEnumLabel();
  if (tags.length === 0) return <span className="rm-empty-value">—</span>;
  return (
    <Flex gap={4} wrap>
      {tags.map((tag) => (
        <Tag key={tag} color={CONTACT_TAG_COLORS[tag]} className="rm-contact-tag">
          {label('ContactTag', tag)}
        </Tag>
      ))}
    </Flex>
  );
}
