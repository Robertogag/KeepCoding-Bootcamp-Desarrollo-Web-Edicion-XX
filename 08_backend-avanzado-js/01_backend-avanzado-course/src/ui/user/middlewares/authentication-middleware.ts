import { Request, Response, NextFunction } from 'express';
import { SecurityServiceImplementation } from '../../../infrastructure/user/services/SecurityServiceImplementation';
import { UnauthorizedError } from '../../../domain/errors/UnauthorizedError';

export const authenticationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // obtener el token de la request.
  const token = req.headers.authorization;

  // verificar que el token esté presente - si no lo está, arrojamos un error.
  if (!token) {
    throw new UnauthorizedError('Token not in request');
  }

  const sanitizedToken = token.replace('Bearer ', '');

  // Si está, verificamos el token
  const securityService = new SecurityServiceImplementation();

  const decodedToken = securityService.verifyJwt(sanitizedToken);
  req.userId = decodedToken?.userId;

  // Si el token ha sido verificado, llamamos a next()
  if (decodedToken) {
    next();
  } else {
    // si el token no se ha verificado, lanzaremos un error
    throw new UnauthorizedError('Token not valid');
  }
};
