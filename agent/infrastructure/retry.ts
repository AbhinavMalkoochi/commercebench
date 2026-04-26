export async function withRetries<T>(
  operation: () => Promise<T>,
  options?: {
    attempts?: number;
    initialDelayMs?: number;
  },
): Promise<T> {
  const attempts = options?.attempts ?? 3;
  const initialDelayMs = options?.initialDelayMs ?? 250;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        break;
      }

      const delayMs = initialDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}