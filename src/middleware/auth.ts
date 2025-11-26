import { Request, Response, NextFunction } from 'express';
import config from '../config.js';
import logger from '../utils/logger.js';

/**
 * Middleware to validate API key authentication
 * Supports multiple methods:
 * - Authorization header (Bearer token)
 * - x-api-key header
 * - apiKey query parameter
 */
export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  let apiKey: string | undefined;

  // Try Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    } else {
      apiKey = authHeader; // Use as-is if not Bearer
    }
  }

  // Fall back to x-api-key header
  if (!apiKey) {
    apiKey = req.headers['x-api-key'] as string;
  }

  // Fall back to query parameter
  if (!apiKey) {
    apiKey = req.query.apiKey as string;
  }

  if (!apiKey) {
    logger.warn('Request missing API key', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      headers: Object.keys(req.headers),
      query: Object.keys(req.query),
    });
    res.status(401).json({
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key is required. Include it in the Authorization header, x-api-key header, or apiKey query parameter.',
      },
    });
    return;
  }

  if (apiKey !== config.apiKey) {
    logger.warn('Invalid API key attempt', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      apiKeyPrefix: apiKey.substring(0, 8) + '...',
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
    method: req.method,
  });

  next();
}

export default validateApiKey;
