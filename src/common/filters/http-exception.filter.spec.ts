import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  type ArgumentsHost,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type Request, type Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';

const FROZEN_TIMESTAMP = '2026-01-01T00:00:00.000Z';
const PRISMA_CLIENT_VERSION = '7.10.1';

function createHttpHost(method: string, path: string) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const request = { method, path } as unknown as Request;
  const response = { status } as unknown as Response;
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let errorSpy: jest.SpiedFunction<typeof Logger.prototype.error>;
  let warnSpy: jest.SpiedFunction<typeof Logger.prototype.warn>;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(FROZEN_TIMESTAMP));
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('maps unknown errors to a generic 500 without leaking internals', () => {
    const { host, status, json } = createHttpHost('GET', '/api/v1/links');
    const secret = 'postgresql://admin:s3cr3t@db.internal:5432/app';
    const exception = new Error(`connect ECONNREFUSED ${secret}`);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      path: '/api/v1/links',
      timestamp: FROZEN_TIMESTAMP,
    });

    const serializedResponse = JSON.stringify(json.mock.calls);

    expect(serializedResponse).not.toContain(secret);
    expect(serializedResponse).not.toContain('ECONNREFUSED');
    expect(serializedResponse).not.toContain('stack');

    expect(errorSpy).toHaveBeenCalledWith(
      `GET /api/v1/links -> 500: connect ECONNREFUSED ${secret}`,
      exception.stack,
    );
  });

  it('keeps the status and message of client HttpExceptions and logs a warning', () => {
    const { host, status, json } = createHttpHost('GET', '/api/v1/links/missing');

    filter.catch(new NotFoundException('Link not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Link not found',
      path: '/api/v1/links/missing',
      timestamp: FROZEN_TIMESTAMP,
    });
    expect(warnSpy).toHaveBeenCalledWith('GET /api/v1/links/missing -> 404: Link not found');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('uses a plain string response of an HttpException as the message', () => {
    const { host, json } = createHttpHost('GET', '/api/v1/teapot');

    filter.catch(new HttpException('Custom failure', 418), host);

    expect(json).toHaveBeenCalledWith({
      statusCode: 418,
      message: 'Custom failure',
      path: '/api/v1/teapot',
      timestamp: FROZEN_TIMESTAMP,
    });
  });

  it('joins array messages from HttpExceptions into a single message', () => {
    const { host, json } = createHttpHost('POST', '/api/v1/links');
    const exception = new HttpException(
      { statusCode: 400, message: ['url must be a URL', 'name should not be empty'] },
      400,
    );

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'url must be a URL; name should not be empty',
      path: '/api/v1/links',
      timestamp: FROZEN_TIMESTAMP,
    });
  });

  it('forwards validation details produced by the ValidationPipe', () => {
    const { host, status, json } = createHttpHost('POST', '/api/v1/links');
    const validationErrors = [
      { field: 'url', constraints: { isUrl: 'url must be a URL address' } },
    ];

    filter.catch(
      new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors: validationErrors,
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Validation failed',
      path: '/api/v1/links',
      timestamp: FROZEN_TIMESTAMP,
      errors: validationErrors,
    });
  });

  it('masks HttpException messages for server errors', () => {
    const { host, status, json } = createHttpHost('GET', '/api/v1/links');

    filter.catch(new InternalServerErrorException('Database replica is down'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      path: '/api/v1/links',
      timestamp: FROZEN_TIMESTAMP,
    });
  });

  it('survives exceptions that are not Error instances', () => {
    const { host, status, json } = createHttpHost('DELETE', '/api/v1/links/abc');

    filter.catch('boom', host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      path: '/api/v1/links/abc',
      timestamp: FROZEN_TIMESTAMP,
    });
    expect(errorSpy).toHaveBeenCalledWith('DELETE /api/v1/links/abc -> 500: boom');
  });

  it('maps Prisma unique constraint violations to a 409 without leaking the original error', () => {
    const { host, status, json } = createHttpHost('POST', '/api/v1/users');
    const secret = 'sk-live-9f8e7d6c5b4a';
    const exception = new Prisma.PrismaClientKnownRequestError(
      `Unique constraint failed on the fields: (\`apiKey\`) value: ${secret}`,
      { code: 'P2002', clientVersion: PRISMA_CLIENT_VERSION, meta: { target: ['apiKey'] } },
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      message: 'Resource already exists',
      path: '/api/v1/users',
      timestamp: FROZEN_TIMESTAMP,
    });

    const serializedResponse = JSON.stringify(json.mock.calls);

    expect(serializedResponse).not.toContain(secret);
    expect(serializedResponse).not.toContain('Unique constraint failed');
    expect(warnSpy).toHaveBeenCalledWith(
      `POST /api/v1/users -> 409: Unique constraint failed on the fields: (\`apiKey\`) value: ${secret}`,
    );
  });

  it('maps Prisma record-not-found to a 404', () => {
    const { host, status, json } = createHttpHost('DELETE', '/api/v1/links/missing');
    const exception = new Prisma.PrismaClientKnownRequestError(
      'An operation failed because it depends on one or more records that were required but not found.',
      { code: 'P2025', clientVersion: PRISMA_CLIENT_VERSION },
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Resource not found',
      path: '/api/v1/links/missing',
      timestamp: FROZEN_TIMESTAMP,
    });
  });

  it('maps Prisma validation errors to a 400', () => {
    const { host, status, json } = createHttpHost('GET', '/api/v1/links');
    const exception = new Prisma.PrismaClientValidationError('Argument `where` is missing.', {
      clientVersion: PRISMA_CLIENT_VERSION,
    });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Invalid request data',
      path: '/api/v1/links',
      timestamp: FROZEN_TIMESTAMP,
    });
  });

  it('maps Prisma initialisation failures to a 503 without leaking the connection string', () => {
    const { host, status, json } = createHttpHost('GET', '/api/v1/links');
    const connectionString = 'postgresql://admin:s3cr3t@db.internal:5432/app';
    const exception = new Prisma.PrismaClientInitializationError(
      `Can't reach database server. Connection string: ${connectionString}`,
      PRISMA_CLIENT_VERSION,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      statusCode: 503,
      message: 'Service temporarily unavailable',
      path: '/api/v1/links',
      timestamp: FROZEN_TIMESTAMP,
    });

    const serializedResponse = JSON.stringify(json.mock.calls);

    expect(serializedResponse).not.toContain(connectionString);
    expect(serializedResponse).not.toContain("Can't reach database server");
    expect(errorSpy).toHaveBeenCalledWith(
      `GET /api/v1/links -> 503: Can't reach database server. Connection string: ${connectionString}`,
      exception.stack,
    );
  });

  it('keeps unmapped Prisma error codes as a generic 500', () => {
    const { host, status, json } = createHttpHost('GET', '/api/v1/links');
    const exception = new Prisma.PrismaClientKnownRequestError(
      'Transaction failed due to a write conflict or a deadlock.',
      { code: 'P2034', clientVersion: PRISMA_CLIENT_VERSION },
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      path: '/api/v1/links',
      timestamp: FROZEN_TIMESTAMP,
    });

    const serializedResponse = JSON.stringify(json.mock.calls);

    expect(serializedResponse).not.toContain('write conflict');
    expect(errorSpy).toHaveBeenCalledWith(
      'GET /api/v1/links -> 500: Transaction failed due to a write conflict or a deadlock.',
      exception.stack,
    );
  });
});
