import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    if (!response.headersSent) {
      const header = request.headers['x-request-id'];
      const requestId =
        typeof header === 'string' && header ? header : randomUUID();
      request.headers['x-request-id'] = requestId;
      response.setHeader('x-request-id', requestId);
    }
    return next.handle();
  }
}
