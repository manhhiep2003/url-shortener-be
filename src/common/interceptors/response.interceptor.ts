import {
  HttpStatus,
  Injectable,
  StreamableFile,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { type Response } from 'express';

const SUCCESS_MESSAGE = 'Success';
const NO_CONTENT_STATUS: number = HttpStatus.NO_CONTENT;

export interface ResponseBody<T> {
  statusCode: number;
  message: string;
  data: T | null;
  timestamp: string;
}

function shouldBypassWrapping(statusCode: number, data: unknown): boolean {
  return (
    statusCode === NO_CONTENT_STATUS || data instanceof StreamableFile || data instanceof Buffer
  );
}

/**
 * Wraps every successful controller result in the same envelope the
 * `HttpExceptionFilter` uses for errors, so clients always deal with one shape:
 * `{ statusCode, message, data, timestamp }`.
 *
 * Bypass rules (the raw value is passed through untouched):
 * - 204 No Content responses, which must not carry a body.
 * - `StreamableFile` and `Buffer` payloads used for file/binary downloads,
 *   which would be corrupted by the JSON serialisation.
 */
@Injectable()
export class ResponseInterceptor<T = unknown> implements NestInterceptor<T, ResponseBody<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ResponseBody<T> | T> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: T): ResponseBody<T> | T => {
        if (shouldBypassWrapping(response.statusCode, data)) {
          return data;
        }

        return {
          statusCode: response.statusCode,
          message: SUCCESS_MESSAGE,
          data: data ?? null,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
