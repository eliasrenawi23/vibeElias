import { enumValues, type EnumValue, type LabelledEnumName } from '@renawi/shared';
import { useCallback, useMemo } from 'react';
import { useDynamicT } from './i18n';

/** Translated label of an enum value (`enums.<Name>.<VALUE>`). */
export function useEnumLabel(): <N extends LabelledEnumName>(name: N, value: EnumValue<N>) => string {
  const dynamicT = useDynamicT();
  return useCallback(
    <N extends LabelledEnumName>(name: N, value: EnumValue<N>) =>
      dynamicT(`enums.${name}.${String(value)}`),
    [dynamicT],
  );
}

export interface EnumOption<V extends string = string> {
  value: V;
  label: string;
}

/** `{ value, label }` options for an enum (all values, or the given subset in that order). */
export function useEnumOptions<N extends LabelledEnumName>(
  name: N,
  values?: readonly EnumValue<N>[],
): EnumOption<EnumValue<N> & string>[] {
  const label = useEnumLabel();
  return useMemo(
    () =>
      (values ?? enumValues(name)).map((value) => ({
        value: value as EnumValue<N> & string,
        label: label(name, value),
      })),
    [name, values, label],
  );
}
