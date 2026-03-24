import express, { Request, Response, NextFunction } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
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
  // Keyed by SSEServerTransport's internal sessionId (UUID), NOT our session manager's hex ID
  private transports: Map<string, SSEServerTransport> = new Map();
  // Maps transport sessionId → our session manager ID for cleanup
  private transportToSession: Map<string, string> = new Map();

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

    // JSON parsing — skip /messages route so SSEServerTransport can read the raw body
    this.app.use((req, res, next) => {
      if (req.path === '/messages') {
        return next();
      }
      express.json()(req, res, next);
    });

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

          // Create session in our manager
          const session = sessionManager.createSession();
          logger.info('Session created', { sessionId: session.id });

          // Create MCP transport — each gets its own Server instance
          const transport = await this.mcpServer.createTransport(session.id, res);

          // Store transport by its OWN sessionId (the UUID the client will use)
          const transportSessionId = transport.sessionId;
          this.transports.set(transportSessionId, transport);
          this.transportToSession.set(transportSessionId, session.id);

          logger.info('Transport registered', {
            ourSessionId: session.id,
            transportSessionId,
          });

          // Handle client disconnect
          req.on('close', () => {
            logger.info('SSE connection closed', { transportSessionId });
            this.transports.delete(transportSessionId);
            this.transportToSession.delete(transportSessionId);
            this.mcpServer.removeSession(session.id);
            sessionManager.removeSession(session.id);
          });

          // Update activity periodically
          const activityInterval = setInterval(() => {
            sessionManager.updateActivity(session.id);
          }, 30000);

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
    // Routes POST messages to the correct SSEServerTransport by its sessionId
    this.app.post(
      '/messages',
      validateApiKey,
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          const sessionId = req.query.sessionId as string;
          if (!sessionId) {
            res.status(400).json({
              error: {
                code: 'MISSING_SESSION_ID',
                message: 'sessionId query parameter is required',
              },
            });
            return;
          }

          const transport = this.transports.get(sessionId);
          if (!transport) {
            logger.warn('Transport not found for sessionId', {
              sessionId,
              knownSessions: Array.from(this.transports.keys()),
            });
            res.status(404).json({
              error: {
                code: 'SESSION_NOT_FOUND',
                message: 'No active session found for the given sessionId',
              },
            });
            return;
          }

          // Forward the message to the SSE transport for handling
          await transport.handlePostMessage(req, res);
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
