import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type Request, type Response } from 'express';

const GENERIC_ERROR_MESSAGE = 'Internal server error';
const SERVER_ERROR_MIN_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;

export interface ErrorResponseBody {
  statusCode: number;
  message: string;
  path: string;
  timestamp: string;
  errors?: unknown[];
}

interface MappedException {
  statusCode: number;
  message: string;
}

/**
 * Prisma error codes that have a well-defined client-facing meaning.
 * The mapped messages are constants and never include the original error
 * (which may embed query details, column values or connection strings).
 */
const PRISMA_KNOWN_ERROR_MAPPING = new Map<string, MappedException>([
  ['P2000', { statusCode: HttpStatus.BAD_REQUEST, message: 'Invalid input data' }],
  ['P2002', { statusCode: HttpStatus.CONFLICT, message: 'Resource already exists' }],
  ['P2003', { statusCode: HttpStatus.CONFLICT, message: 'Related resource conflict' }],
  ['P2025', { statusCode: HttpStatus.NOT_FOUND, message: 'Resource not found' }],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function describeException(exception: unknown): string {
  if (exception instanceof Error) {
    return exception.message;
  }

  if (typeof exception === 'string') {
    return exception;
  }

  return 'Non-error exception thrown';
}

function mapPrismaException(exception: unknown): MappedException | undefined {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    return PRISMA_KNOWN_ERROR_MAPPING.get(exception.code);
  }

  if (exception instanceof Prisma.PrismaClientValidationError) {
    return { statusCode: HttpStatus.BAD_REQUEST, message: 'Invalid request data' };
  }

  if (exception instanceof Prisma.PrismaClientInitializationError) {
    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'Service temporarily unavailable',
    };
  }

  return undefined;
}

/**
 * Last-resort handler for every exception that escapes the application.
 *
 * All responses follow the same envelope so clients can rely on a single shape:
 * `{ statusCode, message, path, timestamp, errors? }`.
 *
 * Safety rules:
 * - 5xx responses never expose the original error (message, stack, cause);
 *   only the generic message is returned and full details go to the server log.
 * - 4xx responses expose only the `message` and `errors` fields of an intentionally
 *   thrown `HttpException`; the rest of its payload is never copied through.
 * - Prisma errors are translated to fixed status/message pairs (see
 *   `PRISMA_KNOWN_ERROR_MAPPING`); the original Prisma message is only logged.
 * - `path` never includes the query string, which could contain tokens or secrets.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const mapping = mapPrismaException(exception);
    const statusCode =
      mapping?.statusCode ??
      (exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR);

    const body: ErrorResponseBody = {
      statusCode,
      message: mapping?.message ?? this.resolveMessage(exception, statusCode),
      path: request.path,
      timestamp: new Date().toISOString(),
    };

    const errors = this.resolveErrors(exception, statusCode);

    if (errors !== undefined) {
      body.errors = errors;
    }

    this.logException(exception, request, statusCode);

    response.status(statusCode).json(body);
  }

  private resolveMessage(exception: unknown, statusCode: number): string {
    if (statusCode >= SERVER_ERROR_MIN_STATUS || !(exception instanceof HttpException)) {
      return GENERIC_ERROR_MESSAGE;
    }

    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (isRecord(exceptionResponse)) {
      const { message } = exceptionResponse;

      if (typeof message === 'string') {
        return message;
      }

      if (isUnknownArray(message)) {
        const parts = message.filter((item): item is string => typeof item === 'string');

        if (parts.length > 0) {
          return parts.join('; ');
        }
      }
    }

    return exception.message;
  }

  private resolveErrors(exception: unknown, statusCode: number): unknown[] | undefined {
    if (statusCode >= SERVER_ERROR_MIN_STATUS || !(exception instanceof HttpException)) {
      return undefined;
    }

    const exceptionResponse = exception.getResponse();

    if (!isRecord(exceptionResponse)) {
      return undefined;
    }

    const { errors } = exceptionResponse;

    return isUnknownArray(errors) && errors.length > 0 ? errors : undefined;
  }

  private logException(exception: unknown, request: Request, statusCode: number): void {
    const description = describeException(exception);
    const context = `${request.method} ${request.path} -> ${statusCode}: ${description}`;

    if (statusCode < SERVER_ERROR_MIN_STATUS) {
      this.logger.warn(context);
      return;
    }

    const stack = exception instanceof Error ? exception.stack : undefined;

    if (stack === undefined) {
      this.logger.error(context);
    } else {
      this.logger.error(context, stack);
    }
  }
}
