// Server mode only (the ".api.ts" page extension is not used by the GitHub Pages static build). Runs once when the Node server starts:
// starts the seller sales-freeze timer (checks every 5 minutes; reads also check, so nothing is missed after a restart).
// The import must sit inside the NEXT_RUNTIME === "nodejs" block (not after an early return): only then does the edge build drop it.
// Otherwise `npm run dev` bundles pg for edge ("Can't resolve 'fs'") and every page answers 500.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startFreezeTimer, releaseDueFreezes } = await import("./lib/server/sellers");
    startFreezeTimer();
    releaseDueFreezes(true).catch((e) => console.error("[sellers] freeze timer:", e));
  }
}
