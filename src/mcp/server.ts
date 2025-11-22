import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Request, Response } from 'express';
import logger from '../utils/logger.js';
import swiftBridge from '../utils/swift-bridge.js';
import tools from './tools.js';
import toolHandlers from './handlers.js';

export class MCPServerManager {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'apple-reminders-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle list tools request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Listing available tools');
      return { tools };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logger.info('Executing tool', { name, args });

      try {
        const handler = toolHandlers[name];
        if (!handler) {
          throw new Error(`Unknown tool: ${name}`);
        }

        const result = await handler(args || {});

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        logger.error('Tool execution failed', {
          name,
          error: errorMessage,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: errorMessage,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Create SSE transport for a client connection
   */
  async createTransport(req: Request, res: Response): Promise<SSEServerTransport> {
    logger.info('Creating SSE transport for client');

    const transport = new SSEServerTransport('/messages', res);
    await this.server.connect(transport);

    // Start Swift bridge if not already started
    await swiftBridge.start();

    return transport;
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(message: any): Promise<void> {
    // Messages are handled by the transport/server automatically
    logger.debug('Message received', { message });
  }

  /**
   * Get the server instance
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Shutdown the server
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down MCP server');
    await swiftBridge.stop();
    await this.server.close();
  }
}

export default MCPServerManager;
