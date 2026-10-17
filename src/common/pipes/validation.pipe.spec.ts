import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { IsString, IsUrl, MaxLength } from 'class-validator';
import { ValidationPipe } from './validation.pipe';

class TestDto {
  @IsString()
  @MaxLength(10)
  name: string;

  @IsUrl()
  url: string;
}

interface ValidationErrorResponse {
  statusCode: number;
  message: string;
  errors: Array<{
    field: string;
    constraints: Record<string, string>;
  }>;
}

const bodyMetadata: ArgumentMetadata = { type: 'body', metatype: TestDto };

describe('ValidationPipe', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe();
  });

  it('transforms a valid payload into a DTO instance', async () => {
    const payload = { name: 'abc', url: 'https://example.com' };

    const result = await pipe.transform(payload, bodyMetadata);

    expect(result).toBeInstanceOf(TestDto);
    expect(result).toEqual(payload);
  });

  it('strips properties that are not whitelisted by the DTO', async () => {
    const result = await pipe.transform(
      { name: 'abc', url: 'https://example.com', extra: 'should-be-removed' },
      bodyMetadata,
    );

    expect(result).toEqual({ name: 'abc', url: 'https://example.com' });
  });

  it('rejects an invalid payload with a BadRequestException carrying formatted errors', async () => {
    const payload = { name: 'this-name-is-way-too-long', url: 'not-a-url' };

    let exception: unknown = null;

    try {
      await pipe.transform(payload, bodyMetadata);
    } catch (error: unknown) {
      exception = error;
    }

    expect(exception).toBeInstanceOf(BadRequestException);

    if (!(exception instanceof BadRequestException)) {
      throw new Error('Expected ValidationPipe to reject with BadRequestException');
    }

    const response = exception.getResponse() as ValidationErrorResponse;

    expect(response.statusCode).toBe(400);
    expect(response.message).toBe('Validation failed');

    const failingFields = response.errors.map((error) => error.field).sort();
    expect(failingFields).toEqual(['name', 'url']);

    const constraintKeys = Object.fromEntries(
      response.errors.map(({ field, constraints }) => [field, Object.keys(constraints ?? {})]),
    );
    expect(constraintKeys).toEqual({
      name: ['maxLength'],
      url: ['isUrl'],
    });
  });

  it('returns the value untouched when the metatype is missing', async () => {
    const value = { foo: 'bar' };

    const result = await pipe.transform(value, { type: 'body' });

    expect(result).toBe(value);
  });

  it('returns the value untouched for non-validatable metatypes', async () => {
    const value = 'this-is-a-plain-string';

    const result = await pipe.transform(value, { type: 'param', metatype: String });

    expect(result).toBe(value);
  });

  it('returns nullish values untouched', async () => {
    await expect(pipe.transform(null, bodyMetadata)).resolves.toBeNull();
    await expect(pipe.transform(undefined, bodyMetadata)).resolves.toBeUndefined();
  });
});
