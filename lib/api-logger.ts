// lib/api-logger.ts
// Phase 6: API request logging middleware

export interface ApiLog {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  userId?: string;
  error?: string;
}

export function logApiRequest(log: ApiLog) {
  const timestamp = new Date().toISOString();
  const message = `${timestamp} ${log.method} ${log.path} ${log.statusCode} ${log.duration}ms`;
  
  if (log.error) {
    console.error(message, { error: log.error, userId: log.userId });
  } else {
    console.log(message);
  }
}

// Simplified version for use in API routes (no middleware needed for Pages Router)
export async function withApiLogging<T>(
  method: string,
  path: string,
  handler: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  let error: string | undefined;
  let result: T;
  
  try {
    result = await handler();
    return { result, duration: Date.now() - start };
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
    throw e;
  } finally {
    const duration = Date.now() - start;
    logApiRequest({ method, path, statusCode: error ? 500 : 200, duration, error });
  }
}
