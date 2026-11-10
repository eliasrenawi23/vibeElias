import { Tag, type TagProps } from 'antd';
import { toneClassName, type Tone } from '../lib/statusTones';

export interface ToneTagProps extends Omit<TagProps, 'color' | 'variant'> {
  /** Colour family from the tone registry (`shared/lib/statusTones.ts`). */
  tone: Tone;
}

/**
 * An AntD `Tag` painted in a brand tone. For labels that are not an enum value ("Taxi",
 * "Paid up", "Open"); enum values use `StatusTag`, alert codes `AlertTags`.
 */
export function ToneTag({ tone, className, ...rest }: ToneTagProps) {
  return (
    <Tag
      {...rest}
      className={className ? `${toneClassName(tone)} ${className}` : toneClassName(tone)}
      data-tone={tone}
    />
  );
}
