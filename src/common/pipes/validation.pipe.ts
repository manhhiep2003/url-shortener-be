import {
  BadRequestException,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
  type Type,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

interface FormattedValidationError {
  field: string;
  constraints: Record<string, string>;
}

const NON_VALIDATABLE_TYPES: readonly Type<object>[] = [String, Boolean, Number, Array, Object];

function isMetatypeValidatable(metatype: Type<object> | undefined): metatype is Type<object> {
  return metatype !== undefined && !NON_VALIDATABLE_TYPES.includes(metatype);
}

function formatValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): FormattedValidationError[] {
  const formattedErrors: FormattedValidationError[] = [];

  for (const error of errors) {
    const field = parentPath === '' ? error.property : `${parentPath}.${error.property}`;

    if (error.constraints !== undefined) {
      formattedErrors.push({ field, constraints: error.constraints });
    }

    formattedErrors.push(...formatValidationErrors(error.children ?? [], field));
  }

  return formattedErrors;
}

@Injectable()
export class ValidationPipe implements PipeTransform<unknown, Promise<unknown>> {
  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    const metatype = metadata.metatype;

    if (value === null || value === undefined || !isMetatypeValidatable(metatype)) {
      return value;
    }

    const dto: object = plainToInstance(metatype, value);

    const errors = await validate(dto, {
      whitelist: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors: formatValidationErrors(errors),
      });
    }

    return dto;
  }
}
