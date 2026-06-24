import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '../../../generated/prisma/client.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let code = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          code = HttpStatus.CONFLICT;
          message = 'Resource already exists';
          break;
        case 'P2025':
          code = HttpStatus.NOT_FOUND;
          message = 'Resource not found';
          break;
        default:
          code = HttpStatus.BAD_REQUEST;
          message = 'Database request error';
      }
    } else if (exception instanceof HttpException) {
      code = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : (((res as Record<string, unknown>).message as string) ??
            exception.message);
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(code).json({ code, message, data: {} });
  }
}
