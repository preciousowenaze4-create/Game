/**
 * Smart Game URL Helper
 * Directs game runner to official Unity WebGL car simulation and clean web runners
 */

export const OFFICIAL_UNITY_CAR_SIM_URL =
  'https://play.unity.com/en/games/b8915ae5-7634-4424-93ad-73778832a84b/car-sim-test';

export function resolvePlayableGameUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return OFFICIAL_UNITY_CAR_SIM_URL;
  const url = rawUrl.trim();

  // If this is a local API endpoint (like /api/games/.../content)
  if (url.startsWith('/api/')) {
    return url;
  }

  // Official Unity WebGL Car Sim
  if (url.includes('unity.com') || url.includes('car-sim') || url.includes('b8915ae5')) {
    return OFFICIAL_UNITY_CAR_SIM_URL;
  }

  return url;
}
