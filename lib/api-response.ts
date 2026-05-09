// lib/api-response.ts
export function successResponse(data: unknown, message?: string) {
  return { success: true, data, message };
}

export function errorResponse(code: string, message: string, details?: unknown) {
  return { success: false, error: { code, message, ...(details !== undefined ? { details } : {}) } };
}
