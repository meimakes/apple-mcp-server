import { Request, Response, NextFunction } from 'express';
import config from '../config.js';
import logger from '../utils/logger.js';

/**
 * Middleware to validate API key authentication
 */
export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    logger.warn('Request missing API key', {
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key is required. Include it in the x-api-key header.',
      },
    });
    return;
  }

  if (apiKey !== config.apiKey) {
    logger.warn('Invalid API key attempt', {
      ip: req.ip,
      path: req.path,
    });
    res.status(403).json({
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key provided.',
      },
    });
    return;
  }

  // API key is valid
  logger.debug('API key validated', {
    ip: req.ip,
    path: req.path,
  });

  next();
}

export default validateApiKey;
