import { apiConfig } from './config';

type ApiSuccess<TData> = {
  success: true;
  data: TData;
  message?: string;
};

type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: unknown;

  public constructor(statusCode: number, code: string, message: string, details: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const requestApi = async <TData>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    accessToken?: string;
  } = {},
): Promise<TData> => {
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.accessToken === undefined ? {} : { Authorization: `Bearer ${options.accessToken}` }),
    },
  };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${apiConfig.baseUrl}${path}`, init);
  const payload = (await response.json()) as ApiResponse<TData>;

  if (!payload.success) {
    throw new ApiError(response.status, payload.error.code, payload.error.message, payload.error.details);
  }

  return payload.data;
};
