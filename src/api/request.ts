import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  ApiError,
  normalizeApiError,
} from "./errors";

type ApiRequestOptions = {
  message?: string;
  // Only set when repeating the operation is safe, such as for reads.
  retries?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new ApiError(API_ERROR_MESSAGES.CANCELLED, {
          code: API_ERROR_CODES.CANCELLED,
        }),
      );
      return;
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, delayMs);
    const abort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      reject(
        new ApiError(API_ERROR_MESSAGES.CANCELLED, {
          code: API_ERROR_CODES.CANCELLED,
        }),
      );
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function runApiRequest<T>(
  request: (signal: AbortSignal) => Promise<T>,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    retries = 0,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    message,
  } = options;

  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    let rejectAborted!: (error: Error) => void;
    const aborted = new Promise<never>((_resolve, reject) => {
      rejectAborted = reject;
    });
    const rejectOnAbort = () => rejectAborted(new Error("Request aborted."));
    controller.signal.addEventListener("abort", rejectOnAbort, { once: true });

    try {
      if (signal?.aborted) {
        throw new ApiError(API_ERROR_MESSAGES.CANCELLED, {
          code: API_ERROR_CODES.CANCELLED,
        });
      }
      // Some SDK operations do not consume AbortSignal. Racing the signal still
      // bounds caller wait time; timed-out side effects may continue remotely.
      return await Promise.race([
        Promise.resolve().then(() => request(controller.signal)),
        aborted,
      ]);
    } catch (error) {
      const cancelled = signal?.aborted;
      const original = cancelled
        ? new ApiError(API_ERROR_MESSAGES.CANCELLED, {
            code: API_ERROR_CODES.CANCELLED,
            cause: error,
          })
        : timedOut
          ? new ApiError(API_ERROR_MESSAGES.TIMEOUT, {
              code: API_ERROR_CODES.TIMEOUT,
              cause: error,
            })
          : normalizeApiError(error, message);
      const safeToRetry =
        retries > 0 &&
        !cancelled &&
        (original.code === API_ERROR_CODES.TIMEOUT ||
          original.code === API_ERROR_CODES.NETWORK_ERROR ||
          original.code === API_ERROR_CODES.SERVER_ERROR ||
          original.code === API_ERROR_CODES.RATE_LIMITED);
      const apiError = new ApiError(original.message, {
        cause: original.cause,
        code: original.code,
        retryable: safeToRetry,
        status: original.status,
      });

      if (!safeToRetry || attempt >= retries) throw apiError;
      // Do not retry a rate-limited request without knowing its retry-after time.
      if (original.code === API_ERROR_CODES.RATE_LIMITED) throw apiError;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      controller.signal.removeEventListener("abort", rejectOnAbort);
      await waitForRetry(Math.min(250 * 2 ** attempt, 2_000), signal);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
}
