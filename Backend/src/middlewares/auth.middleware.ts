import { Request, Response, NextFunction } from 'express';
import { expressjwt } from 'express-jwt';
import config from '../config/config';

// JWT authentication middleware
export const authenticate = expressjwt({
  secret: config.jwtSecret,
  algorithms: ['HS256']
});

// Error handler for JWT authentication
export const handleJwtError = (err: any, req: Request, res: Response, next: NextFunction): void => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      status: 'error',
      message: 'Invalid token. Please log in again.'
    });
  } else {
    next(err);
  }
};