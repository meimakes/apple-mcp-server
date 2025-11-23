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
  private transports: Map<string, any> = new Map();

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
          logger.info('SSE connection request received', { ip: req.ip });

          // Create session
          const session = sessionManager.createSession();
          logger.info('Session created', { sessionId: session.id });

          // Create MCP transport - this handles all SSE setup
          const transport = await this.mcpServer.createTransport(session.id, res);
          this.transports.set(session.id, transport);

          // Handle client disconnect
          req.on('close', () => {
            logger.info('SSE connection closed', { sessionId: session.id });
            this.transports.delete(session.id);
            sessionManager.removeSession(session.id);
          });

          // Update activity periodically
          const activityInterval = setInterval(() => {
            sessionManager.updateActivity(session.id);
          }, 30000); // 30 seconds

          req.on('close', () => {
            clearInterval(activityInterval);
          });
        } catch (error) {
          logger.error('SSE connection error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
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
          logger.debug('Received POST /messages', { body: req.body });

          // Find the session ID from the request
          // The SSEServerTransport will handle the message through its own mechanisms
          // We just acknowledge receipt
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
          path: req.path,
        });

        // Don't send response if headers already sent (SSE case)
        if (!res.headersSent) {
          res.status(500).json({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'An internal server error occurred',
            },
          });
        }
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
