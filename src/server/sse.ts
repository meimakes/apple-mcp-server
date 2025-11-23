import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from '../config.js';
import logger from '../utils/logger.js';
import { validateApiKey } from '../middleware/auth.js';
import MCPServerManager from '../mcp/server.js';
import sessionManager from './session.js';

export class SSEServer {
  private app: express.Application;
  private mcpServer: MCPServerManager;

  constructor() {
    this.app = express();
    this.mcpServer = new MCPServerManager();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Trust proxy for rate limiting and X-Forwarded-For headers (needed for ngrok)
    this.app.set('trust proxy', 1);

    // Security headers
    this.app.use(helmet());

    // JSON parsing
    this.app.use(express.json());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window per IP
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        logger.warn('Rate limit exceeded', { ip: req.ip });
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
          },
        });
      },
    });

    this.app.use(limiter);
  }

  private setupRoutes(): void {
    // Health check (no auth required)
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'Apple Reminders MCP Server',
        version: '1.0.0',
        status: 'running',
        sessions: sessionManager.getActiveSessionCount(),
      });
    });

    // SSE endpoint (requires auth)
    this.app.get(
      '/sse',
      validateApiKey,
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          logger.info('SSE connection established', { ip: req.ip });

          // Create session
          const session = sessionManager.createSession();

          // Set SSE headers
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

          // Create MCP transport
          await this.mcpServer.createTransport(req, res);

          // Handle client disconnect
          req.on('close', () => {
            logger.info('SSE connection closed', { sessionId: session.id });
            sessionManager.removeSession(session.id);
          });

          // Keep connection alive
          const keepAliveInterval = setInterval(() => {
            res.write(':keepalive\n\n');
            sessionManager.updateActivity(session.id);
          }, 30000); // 30 seconds

          req.on('close', () => {
            clearInterval(keepAliveInterval);
          });
        } catch (error) {
          logger.error('SSE connection error', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          next(error);
        }
      }
    );

    // Message endpoint (requires auth)
    this.app.post(
      '/messages',
      validateApiKey,
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          logger.debug('Received message', { body: req.body });

          // The MCP SDK handles the message internally through the transport
          // We just need to acknowledge receipt
          res.status(202).json({ accepted: true });
        } catch (error) {
          logger.error('Message handling error', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          next(error);
        }
      }
    );

    // Error handler
    this.app.use(
      (err: Error, req: Request, res: Response, next: NextFunction) => {
        logger.error('Server error', {
          error: err.message,
          stack: err.stack,
        });

        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An internal server error occurred',
          },
        });
      }
    );
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(config.port, () => {
        logger.info(`SSE server listening on port ${config.port}`);
        logger.info(`Health check: http://localhost:${config.port}/`);
        logger.info(`SSE endpoint: http://localhost:${config.port}/sse`);
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    logger.info('Stopping SSE server');
    await this.mcpServer.shutdown();
    sessionManager.stop();
  }

  /**
   * Get Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }
}

export default SSEServer;
