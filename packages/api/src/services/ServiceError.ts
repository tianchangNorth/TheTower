import type { TowerErrorCode } from "@the-tower/shared";

export class ServiceError extends Error {
  constructor(
    readonly code: TowerErrorCode,
    message: string,
    readonly status: number = 400,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
