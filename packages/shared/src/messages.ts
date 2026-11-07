import { z, ZodIssueCode, type ZodErrorMap } from 'zod';

/**
 * Validation messages are i18n keys (namespace `common`, group `validation`) instead of English
 * text, so the API can return them unchanged and the web translates them.
 *
 * Messages that need parameters are encoded as `key::{"json":"params"}`, e.g.
 * `validation.maxLength::{"max":200}`. Use `parseValidationMessage()` before calling `t()`:
 *
 *   const { key, params } = parseValidationMessage(error.message);
 *   t(key, params);
 */
export const msg = {
  required: 'validation.required',
  invalidValue: 'validation.invalidValue',
  invalidOption: 'validation.invalidOption',
  invalidEmail: 'validation.invalidEmail',
  invalidPhone: 'validation.invalidPhone',
  invalidPlate: 'validation.invalidPlate',
  invalidIdNumber: 'validation.invalidIdNumber',
  invalidVin: 'validation.invalidVin',
  invalidDate: 'validation.invalidDate',
  invalidDateTime: 'validation.invalidDateTime',
  invalidPeriod: 'validation.invalidPeriod',
  invalidNumber: 'validation.invalidNumber',
  invalidAmount: 'validation.invalidAmount',
  invalidPercent: 'validation.invalidPercent',
  integer: 'validation.integer',
  positive: 'validation.positive',
  min: 'validation.min',
  max: 'validation.max',
  minLength: 'validation.minLength',
  maxLength: 'validation.maxLength',
  minItems: 'validation.minItems',
  maxItems: 'validation.maxItems',
  endBeforeStart: 'validation.endBeforeStart',
  passwordTooWeak: 'validation.passwordTooWeak',
  currentPasswordRequired: 'validation.currentPasswordRequired',
  nameRequired: 'validation.nameRequired',
  contactRequired: 'validation.contactRequired',
  ownerDriverRequired: 'validation.ownerDriverRequired',
  vehicleRequired: 'validation.vehicleRequired',
  tradeInSaleOnly: 'validation.tradeInSaleOnly',
  weeklyNotSupported: 'validation.weeklyNotSupported',
  minNetRequired: 'validation.minNetRequired',
  businessScopeNoVehicle: 'validation.businessScopeNoVehicle',
  vehicleScopeNeedsVehicle: 'validation.vehicleScopeNeedsVehicle',
  businessPolicyType: 'validation.businessPolicyType',
  soldAtRequired: 'validation.soldAtRequired',
  exactlyOneOwner: 'validation.exactlyOneOwner',
  nothingToChange: 'validation.nothingToChange',
  depositKindRequired: 'validation.depositKindRequired',
} as const;

export type ValidationMessageKey = (typeof msg)[keyof typeof msg];

const PARAM_SEPARATOR = '::';

/** Encode an i18n key with interpolation params into a single message string. */
export function withParams(
  key: ValidationMessageKey | string,
  params?: Record<string, string | number>,
): string {
  if (!params || Object.keys(params).length === 0) return key;
  return `${key}${PARAM_SEPARATOR}${JSON.stringify(params)}`;
}

/** Decode a message produced by `withParams()` (plain keys and plain text pass through). */
export function parseValidationMessage(message: string): {
  key: string;
  params: Record<string, unknown>;
} {
  const idx = message.indexOf(PARAM_SEPARATOR);
  if (idx === -1) return { key: message, params: {} };
  const key = message.slice(0, idx);
  try {
    const parsed: unknown = JSON.parse(message.slice(idx + PARAM_SEPARATOR.length));
    return {
      key,
      params: parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {},
    };
  } catch {
    return { key, params: {} };
  }
}

/**
 * Zod error map producing i18n message keys for the generic issue codes. Schema-level messages
 * (used for the domain-specific checks) always win over this map.
 */
export const validationErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: msg.required };
      }
      if (issue.expected === 'number' || issue.expected === 'integer') {
        return { message: msg.invalidNumber };
      }
      if (issue.expected === 'date') return { message: msg.invalidDate };
      return { message: msg.invalidValue };
    case ZodIssueCode.too_small: {
      const min = Number(issue.minimum);
      if (issue.type === 'string') {
        return { message: min <= 1 ? msg.required : withParams(msg.minLength, { min }) };
      }
      if (issue.type === 'array' || issue.type === 'set') {
        return { message: min <= 1 ? msg.required : withParams(msg.minItems, { min }) };
      }
      if (issue.type === 'number' || issue.type === 'bigint') {
        if (min === 0 && !issue.inclusive) return { message: msg.positive };
        return { message: withParams(msg.min, { min }) };
      }
      return { message: msg.invalidValue };
    }
    case ZodIssueCode.too_big: {
      const max = Number(issue.maximum);
      if (issue.type === 'string') return { message: withParams(msg.maxLength, { max }) };
      if (issue.type === 'array' || issue.type === 'set') {
        return { message: withParams(msg.maxItems, { max }) };
      }
      if (issue.type === 'number' || issue.type === 'bigint') {
        return { message: withParams(msg.max, { max }) };
      }
      return { message: msg.invalidValue };
    }
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: msg.invalidEmail };
      if (issue.validation === 'datetime') return { message: msg.invalidDateTime };
      if (issue.validation === 'date') return { message: msg.invalidDate };
      return { message: msg.invalidValue };
    case ZodIssueCode.invalid_enum_value:
    case ZodIssueCode.invalid_literal:
    case ZodIssueCode.invalid_union_discriminator:
      return { message: msg.invalidOption };
    case ZodIssueCode.invalid_date:
      return { message: msg.invalidDate };
    case ZodIssueCode.not_finite:
      return { message: msg.invalidNumber };
    case ZodIssueCode.not_multiple_of:
      return { message: msg.invalidValue };
    default:
      return { message: ctx.defaultError };
  }
};

/**
 * Installs `validationErrorMap` globally on the zod instance used by this package. Call once at
 * startup (API bootstrap and web entry) so generic messages become translatable keys.
 */
export function installValidationErrorMap(): void {
  z.setErrorMap(validationErrorMap);
}
