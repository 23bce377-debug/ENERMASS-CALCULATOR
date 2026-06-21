export interface SaasErrorMetadata {
  statusCode: number;
  redirectTo: string;
  userMessage: string;
  internalMessage: string;
}

export class SaasError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly redirectTo: string;
  readonly userMessage: string;
  readonly internalMessage: string;

  static [Symbol.hasInstance](instance: any) {
    if (!instance || typeof instance !== 'object') return false;
    if (this.name === 'SaasError' || this.name === 'DefinedSaasError') {
      return 'statusCode' in instance && 'userMessage' in instance;
    }
    return instance.name === this.name || instance.code === this.name;
  }

  constructor(code: string, metadata: SaasErrorMetadata, cause?: unknown) {
    super(metadata.userMessage);
    this.name = code;
    this.code = code;
    this.statusCode = metadata.statusCode;
    this.redirectTo = metadata.redirectTo;
    this.userMessage = metadata.userMessage;
    this.internalMessage = metadata.internalMessage;
    this.cause = cause;
  }
}

const errorMetadata = {
  SubscriptionExpiredError: {
    statusCode: 402,
    redirectTo: '/settings/billing',
    userMessage: 'Your subscription is not active. Please renew or contact an administrator.',
    internalMessage: 'Subscription gate blocked access because the org has no valid active or trialing subscription.',
  },
  SeatLimitReachedError: {
    statusCode: 409,
    redirectTo: '/settings/billing',
    userMessage: 'Your team has reached its seat limit.',
    internalMessage: 'Seat allocation exceeded the current subscription seat_limit.',
  },
  DeviceMismatchError: {
    statusCode: 403,
    redirectTo: '/device/reset',
    userMessage: 'This login is coming from a different registered device.',
    internalMessage: 'Device session validation failed because the device token or fingerprint did not match.',
  },
  DeviceNotRegisteredError: {
    statusCode: 428,
    redirectTo: '/device/register',
    userMessage: 'Please register this device before continuing.',
    internalMessage: 'Device gate blocked access because no active registered device/session was found.',
  },
  FeatureNotEnabledError: {
    statusCode: 403,
    redirectTo: '/settings/billing',
    userMessage: 'This feature is not included in your current plan.',
    internalMessage: 'Feature gate denied access for a disabled plan feature.',
  },
  UnauthorizedRoleError: {
    statusCode: 403,
    redirectTo: '/dashboard',
    userMessage: 'You do not have permission to perform this action.',
    internalMessage: 'Role authorization failed for a SaaS service operation.',
  },
  MembershipMissingError: {
    statusCode: 403,
    redirectTo: '/login',
    userMessage: 'Your organization membership is missing or disabled.',
    internalMessage: 'Membership lookup failed or returned a non-active status for the requested org.',
  },
} satisfies Record<string, SaasErrorMetadata>;

class DefinedSaasError extends SaasError {
  constructor(code: keyof typeof errorMetadata, cause?: unknown) {
    super(code, errorMetadata[code], cause);
  }
}

export class SubscriptionExpiredError extends DefinedSaasError {
  constructor(cause?: unknown) {
    super('SubscriptionExpiredError', cause);
  }
}

export class SeatLimitReachedError extends DefinedSaasError {
  constructor(cause?: unknown) {
    super('SeatLimitReachedError', cause);
  }
}

export class DeviceMismatchError extends DefinedSaasError {
  constructor(cause?: unknown) {
    super('DeviceMismatchError', cause);
  }
}

export class DeviceNotRegisteredError extends DefinedSaasError {
  constructor(cause?: unknown) {
    super('DeviceNotRegisteredError', cause);
  }
}

export class FeatureNotEnabledError extends DefinedSaasError {
  constructor(cause?: unknown) {
    super('FeatureNotEnabledError', cause);
  }
}

export class UnauthorizedRoleError extends DefinedSaasError {
  constructor(cause?: unknown) {
    super('UnauthorizedRoleError', cause);
  }
}

export class MembershipMissingError extends DefinedSaasError {
  constructor(cause?: unknown) {
    super('MembershipMissingError', cause);
  }
}

export function getSaasErrorMetadata(error: SaasError): SaasErrorMetadata {
  return {
    statusCode: error.statusCode,
    redirectTo: error.redirectTo,
    userMessage: error.userMessage,
    internalMessage: error.internalMessage,
  };
}

