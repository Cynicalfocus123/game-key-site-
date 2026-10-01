// Server mode only (the ".api.ts" page extension is not used by the GitHub Pages static build). Runs once when the Node server starts:
// starts the seller sales-freeze timer (checks every 5 minutes; reads also check, so nothing is missed after a restart).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startFreezeTimer, releaseDueFreezes } = await import("./lib/server/sellers");
  startFreezeTimer();
  releaseDueFreezes(true).catch((e) => console.error("[sellers] freeze timer:", e));
}
