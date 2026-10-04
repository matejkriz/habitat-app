export function consumeLaunchTiming(navigationEpochMs = performance.timeOrigin) {
  try {
    const raw = sessionStorage.getItem("habitat-launch-timing");
    sessionStorage.removeItem("habitat-launch-timing");
    if (!raw) return null;
    const timing = JSON.parse(raw);
    const navigationGapMs = navigationEpochMs - timing.redirectEpochMs;
    if (
      !Number.isFinite(timing.shellMs) || timing.shellMs < 0 ||
      !Number.isFinite(navigationGapMs) || navigationGapMs < 0 ||
      navigationGapMs > 60_000
    ) return null;

    return {
      shellMs: timing.shellMs,
      navigationGapMs,
      addedMs: timing.shellMs + navigationGapMs,
      controlled: timing.controlled === true,
    };
  } catch {
    return null;
  }
}
