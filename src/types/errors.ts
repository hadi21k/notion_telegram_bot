export interface StatusErrorOptions {
  status: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface StatusErrorInterface extends Error {
  status: number;
  details?: Record<string, unknown>;
}
