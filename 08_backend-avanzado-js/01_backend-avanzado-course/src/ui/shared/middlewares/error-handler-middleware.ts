import { NextFunction, Request, Response } from 'express';
import { EntityNotFoundError } from '../../../domain/errors/EntityNotFoundError';
import { BusinessConflictError } from '../../../domain/errors/BusinessConflictError';
import { ForbiddenOperationError } from '../../../domain/errors/ForbiddenOperationError';
import { UnauthorizedError } from '../../../domain/errors/UnauthorizedError';
import { ZodError } from 'zod';
import Sentry from '@sentry/node';

export const errorHandlerMiddleware = (
  error: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) => {
  if (error instanceof EntityNotFoundError) {
    res.status(404).json({ error: error.message });
  } else if (error instanceof BusinessConflictError) {
    res.status(409).json({ error: error.message });
  } else if (error instanceof ForbiddenOperationError) {
    res.status(403).json({ error: error.message });
  } else if (error instanceof UnauthorizedError) {
    res.status(401).json({ error: error.message });
  } else if (error instanceof ZodError) {
    res.status(400).json({
      error: error.issues[0].message,
    });
  } else {
    Sentry.captureException(error, {
      extra: {
        path: req.path,
        method: req.method,
        userId: req.userId,
      },
    });
    res.status(500).json({
      error: JSON.stringify(error),
    });
  }
};
