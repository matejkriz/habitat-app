type TimingOutcome = "ok" | "error";

interface TimingOptions {
  readonly now?: () => number;
  readonly log?: (message: string) => void;
}

export function roundDurationMs(durationMs: number): number {
  if (!Number.isFinite(durationMs)) return 0;
  return Math.round(Math.max(0, durationMs) * 10) / 10;
}

export function formatServerTiming(
  metric: string,
  durationMs: number,
): string {
  return `${metric};dur=${roundDurationMs(durationMs).toFixed(1)}`;
}

function defaultLog(message: string): void {
  if (
    process.env.NODE_ENV !== "test" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    console.info(message);
  }
}

function logOperation(
  operation: string,
  durationMs: number,
  outcome: TimingOutcome,
  log: (message: string) => void,
): void {
  try {
    log(
      JSON.stringify({
        event: "server_operation",
        operation,
        durationMs: roundDurationMs(durationMs),
        outcome,
      }),
    );
  } catch {
    // Telemetry must never alter application behavior.
  }
}

export async function measureServerOperation<Result>(
  operation: string,
  task: () => Promise<Result>,
  options: TimingOptions = {},
): Promise<Result> {
  const now = options.now ?? (() => performance.now());
  const log = options.log ?? defaultLog;
  const startedAt = now();

  try {
    const result = await task();
    logOperation(operation, now() - startedAt, "ok", log);
    return result;
  } catch (error) {
    logOperation(operation, now() - startedAt, "error", log);
    throw error;
  }
}
