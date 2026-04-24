/**
 * Feature flags — derived from deployment mode at boot time.
 * These are compile-time constants after config is loaded.
 */

import type { PolisConfig } from "./types";

export interface FeatureFlags {
  readonly multiTenant: boolean;
  readonly billing: boolean;
  readonly platformAdmin: boolean;
  readonly customDomain: boolean;
  readonly standaloneAuth: boolean;
  readonly ldapSync: boolean;
}

export function features(config: PolisConfig): FeatureFlags {
  const isMultiTenant = config.deploymentMode === "multitenant";
  return {
    multiTenant:    isMultiTenant,
    billing:        isMultiTenant,
    platformAdmin:  isMultiTenant,
    customDomain:   isMultiTenant,
    standaloneAuth: !isMultiTenant,
    ldapSync:       !isMultiTenant,
  } as const;
}
