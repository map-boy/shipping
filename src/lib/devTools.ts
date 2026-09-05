/**
 * Dev tooling is on automatically in `npm run dev`. To use it on a deployed
 * preview, set VITE_ENABLE_DEV_TOOLS=true for that deployment only - never for
 * production, since the simulator writes real driver positions.
 */
export const devToolsEnabled =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_TOOLS === "true";
