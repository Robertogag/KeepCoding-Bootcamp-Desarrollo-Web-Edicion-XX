import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { BusinessConflictError } from '../../../domain/errors/BusinessConflictError';
import { EntityNotFoundError } from '../../../domain/errors/EntityNotFoundError';
import { ForbiddenOperationError } from '../../../domain/errors/ForbiddenOperationError';
import { UnauthorizedError } from '../../../domain/errors/UnauthorizedError';

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
    console.error('Unexpected error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};
