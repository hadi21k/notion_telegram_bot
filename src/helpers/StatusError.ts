import { StatusErrorOptions, StatusErrorInterface } from "../types/errors";

export class StatusError extends Error implements StatusErrorInterface {
  public status: number;
  public details?: Record<string, unknown>;

  constructor(options: StatusErrorOptions) {
    super(options.message);
    this.name = "StatusError";
    this.status = options.status;
    this.details = options.details;

    // This is necessary for proper error inheritance in TypeScript
    Object.setPrototypeOf(this, StatusError.prototype);
  }

  static isStatusError(error: unknown): error is StatusError {
    return error instanceof StatusError;
  }
}
