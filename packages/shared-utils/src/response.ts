import type { ApiResponse, PaginatedResult } from '@platform/shared-types';

export const successResponse = <T>(data: T): ApiResponse<T> => ({
  success: true,
  data,
});

export const errorResponse = (
  code: string,
  message: string,
  details?: unknown
): ApiResponse => ({
  success: false,
  error: { code, message, details },
});

export const paginatedResponse = <T>(
  result: PaginatedResult<T>
): ApiResponse<PaginatedResult<T>> => ({
  success: true,
  data: result,
});