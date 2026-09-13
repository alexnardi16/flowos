// Production release builds overwrite this file in CI before EAS compilation.
// The committed values are intentionally non-authoritative development fallbacks.
export const FLOWOS_BUILD = {
  releaseTag: 'local',
  commitSha: 'unknown',
} as const;
