import { StreamableFile, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { type Response } from 'express';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

const FROZEN_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function createContext(statusCode: number): ExecutionContext {
  const response = { statusCode } as unknown as Response;

  return {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ExecutionContext;
}

function createNext<T>(data: T): CallHandler<T> {
  return { handle: () => of(data) };
}

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(FROZEN_TIMESTAMP));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('wraps payloads in the standard success envelope', async () => {
    const context = createContext(200);
    const next = createNext({ id: 'abc123', url: 'https://example.com' });

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({
      statusCode: 200,
      message: 'Success',
      data: { id: 'abc123', url: 'https://example.com' },
      timestamp: FROZEN_TIMESTAMP,
    });
  });

  it('uses the real response status code in the envelope', async () => {
    const context = createContext(201);
    const next = createNext({ id: 'abc123' });

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({
      statusCode: 201,
      message: 'Success',
      data: { id: 'abc123' },
      timestamp: FROZEN_TIMESTAMP,
    });
  });

  it('serialises undefined payloads as null', async () => {
    const context = createContext(200);
    const next = createNext(undefined);

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({
      statusCode: 200,
      message: 'Success',
      data: null,
      timestamp: FROZEN_TIMESTAMP,
    });
  });

  it('keeps falsy payloads intact instead of replacing them with null', async () => {
    const context = createContext(200);
    const next = createNext(false);

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({
      statusCode: 200,
      message: 'Success',
      data: false,
      timestamp: FROZEN_TIMESTAMP,
    });
  });

  it('bypasses wrapping for 204 No Content responses', async () => {
    const context = createContext(204);
    const next = createNext(undefined);

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toBeUndefined();
  });

  it('bypasses wrapping for StreamableFile payloads', async () => {
    const context = createContext(200);
    const file = new StreamableFile(Buffer.from('hello'));
    const next = createNext(file);

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toBe(file);
  });

  it('bypasses wrapping for raw Buffer payloads', async () => {
    const context = createContext(200);
    const buffer = Buffer.from('binary');
    const next = createNext(buffer);

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toBe(buffer);
  });
});
