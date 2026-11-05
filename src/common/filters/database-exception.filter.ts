import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface PostgresDriverError {
  code?: string;
}

/**
 * Maps PostgreSQL integrity violations to safe HTTP responses.
 *
 * Internal details (SQL, constraint names, column values) are never sent to
 * the client; unexpected database errors are logged and returned as a generic
 * 500.
 */
@Catch(QueryFailedError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const code = (exception.driverError as PostgresDriverError).code;
    const mapped = this.mapError(code);

    if (mapped.status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception.message, exception.stack);
    }

    response.status(mapped.status).json({
      statusCode: mapped.status,
      error: mapped.error,
      message: mapped.message,
    });
  }

  private mapError(code?: string): {
    status: number;
    error: string;
    message: string;
  } {
    switch (code) {
      case '23505':
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'The resource already exists',
        };
      case '23503':
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'The resource is referenced by other records',
        };
      case '23514':
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'The request violates a data constraint',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'Internal server error',
        };
    }
  }
}
