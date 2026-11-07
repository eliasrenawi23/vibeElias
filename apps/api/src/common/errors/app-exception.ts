import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Error messages are i18n keys (namespace `common` of the `@renawi/shared` locales) so the web
 * can translate them: `{ statusCode, message: '<key>', errors?: [{ path, message: '<key>' }] }`.
 */
export const ErrorKey = {
  generic: 'errors.generic',
  validation: 'errors.validation',
  unauthorized: 'errors.unauthorized',
  forbidden: 'errors.forbidden',
  notFound: 'errors.notFound',
  conflict: 'errors.conflict',
  server: 'errors.server',
  fileTooLarge: 'errors.fileTooLarge',
  unsupportedFileType: 'errors.unsupportedFileType',
  invalidTransition: 'errors.invalidTransition',
  useDeal: 'errors.useDeal',
  cycleOpen: 'errors.cycleOpen',
  noOpenCycle: 'errors.noOpenCycle',
  vehicleLeased: 'errors.vehicleLeased',
  dealPending: 'errors.dealPending',
  expenseRebilled: 'errors.expenseRebilled',
  // Milestone 3: taxi licences, drivers, leases, ledger, fines.
  taxiAgeBlocked: 'errors.taxiAgeBlocked',
  vehicleNotTaxi: 'errors.vehicleNotTaxi',
  vehicleAlreadyRegistered: 'errors.vehicleAlreadyRegistered',
  alreadyDriver: 'errors.alreadyDriver',
  driverInactive: 'errors.driverInactive',
  licenseNotActive: 'errors.licenseNotActive',
  vehicleNotAvailable: 'errors.vehicleNotAvailable',
  licenseInUse: 'errors.licenseInUse',
  vehicleInUse: 'errors.vehicleInUse',
  leaseNotEditable: 'errors.leaseNotEditable',
  depositInsufficient: 'errors.depositInsufficient',
  alreadyVoided: 'errors.alreadyVoided',
  fineNoDriver: 'errors.fineNoDriver',
  alreadyRebilled: 'errors.alreadyRebilled',
  // Milestone 4: deals, transfer, expense rebill.
  disclosureRequired: 'errors.disclosureRequired',
  dealNotEditable: 'errors.dealNotEditable',
  dealNotCancellable: 'errors.dealNotCancellable',
  dealHasPayments: 'errors.dealHasPayments',
  systemPayment: 'errors.systemPayment',
  noDriverMatched: 'errors.noDriverMatched',
  invalidCredentials: 'auth.invalidCredentials',
  sessionExpired: 'auth.sessionExpired',
  tooManyAttempts: 'auth.tooManyAttempts',
} as const;
export type ErrorKey = (typeof ErrorKey)[keyof typeof ErrorKey];

/** Field-level message keys used by the API itself (beyond the shared zod `msg` keys). */
export const FieldErrorKey = {
  duplicate: 'validation.duplicate',
  odometerDecreasing: 'validation.odometerDecreasing',
  endAfterStart: 'validation.endAfterStart',
  billingPeriodUnsupported: 'validation.billingPeriodUnsupported',
  /** The date must be today or later (lease end-date extension). */
  dateInPast: 'validation.dateInPast',
  /** A segment change must start after the current segment's start date. */
  segmentStartTooEarly: 'validation.segmentStartTooEarly',
  /** The date lies outside the contract period. */
  outsideContract: 'validation.outsideContract',
} as const;

/** One field-level problem; `path` is the dotted field path (`reminderLeadDays.insurance`). */
export interface FieldError {
  path: string;
  message: string;
}

/** Body of every error response. */
export interface ErrorBody {
  statusCode: number;
  message: string;
  errors?: FieldError[];
}

/** Known application error carrying an i18n key (and optional field errors). */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly key: string,
    readonly fieldErrors?: FieldError[],
  ) {
    const body: ErrorBody = { statusCode: status, message: key };
    if (fieldErrors?.length) body.errors = fieldErrors;
    super(body, status);
  }

  static badRequest(key: string = ErrorKey.validation, errors?: FieldError[]): AppException {
    return new AppException(HttpStatus.BAD_REQUEST, key, errors);
  }

  /** 400 with a single field error, e.g. `fieldError('currentPassword', 'auth.invalidCredentials')`. */
  static fieldError(path: string, message: string): AppException {
    return new AppException(HttpStatus.BAD_REQUEST, ErrorKey.validation, [{ path, message }]);
  }

  static unauthorized(key: string = ErrorKey.unauthorized): AppException {
    return new AppException(HttpStatus.UNAUTHORIZED, key);
  }

  static forbidden(key: string = ErrorKey.forbidden): AppException {
    return new AppException(HttpStatus.FORBIDDEN, key);
  }

  static notFound(key: string = ErrorKey.notFound): AppException {
    return new AppException(HttpStatus.NOT_FOUND, key);
  }

  static conflict(key: string = ErrorKey.conflict, errors?: FieldError[]): AppException {
    return new AppException(HttpStatus.CONFLICT, key, errors);
  }

  /** 409 `errors.conflict` with `[{ path, message: 'validation.duplicate' }]` (unique field taken). */
  static duplicate(path: string): AppException {
    return new AppException(HttpStatus.CONFLICT, ErrorKey.conflict, [
      { path, message: FieldErrorKey.duplicate },
    ]);
  }

  /** 404 for an id referenced in the request body, e.g. `notFoundField('vendorId')`. */
  static notFoundField(path: string): AppException {
    return new AppException(HttpStatus.NOT_FOUND, ErrorKey.notFound, [
      { path, message: ErrorKey.notFound },
    ]);
  }

  static payloadTooLarge(): AppException {
    return new AppException(HttpStatus.PAYLOAD_TOO_LARGE, ErrorKey.fileTooLarge);
  }

  static unsupportedMediaType(): AppException {
    return new AppException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorKey.unsupportedFileType);
  }
}
