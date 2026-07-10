import { SUPPORTED_A2A_ROUTE_MODES } from "@the-tower/shared";
import type { A2ARouteMode, SupportedA2ARouteMode } from "../types.js";

export class UnsupportedRouteModeError extends Error {
  readonly code = "unsupported_route_mode";

  constructor(readonly routeMode: A2ARouteMode) {
    super(`Route mode "${routeMode}" is not supported. Use ${SUPPORTED_A2A_ROUTE_MODES.join(" or ")}.`);
  }
}

export function assertSupportedRouteMode(
  routeMode: A2ARouteMode | undefined,
): asserts routeMode is SupportedA2ARouteMode | undefined {
  if (routeMode && !SUPPORTED_A2A_ROUTE_MODES.includes(routeMode as SupportedA2ARouteMode)) {
    throw new UnsupportedRouteModeError(routeMode);
  }
}
