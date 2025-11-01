export class RequestError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function badRequest(message: string, code?: string): RequestError {
  return new RequestError(400, message, code);
}

export function notFound(message: string, code?: string): RequestError {
  return new RequestError(404, message, code);
}

export function conflict(message: string, code?: string): RequestError {
  return new RequestError(409, message, code);
}

export function internalError(message: string, code?: string): RequestError {
  return new RequestError(500, message, code);
}
