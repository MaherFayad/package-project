/**
 * R6-R1: load the 3D stack in steps. Importing a scene module evaluates three.js core, the React
 * renderer and the engine in one task (~700 ms at 4× CPU). Importing them one after another, with a
 * yield to the browser in between, splits that into three shorter tasks so a tap is not held up.
 * Modules already loaded resolve at once.
 */
async function step(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched?.yield) return sched.yield();
  await new Promise((r) => setTimeout(r, 0));
}

export async function loadEngineStack(): Promise<void> {
  await import("three");
  await step();
  await import("@react-three/fiber");
  await step();
  await import("@react-three/drei");
  await step();
}
