import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Response } from 'express';
import logger from '../utils/logger.js';
import swiftBridge from '../utils/swift-bridge.js';
import tools from './tools.js';
import toolHandlers from './handlers.js';

export class MCPServerManager {
  private servers: Map<string, Server> = new Map();

  /**
   * Create a new MCP Server instance with handlers for a session
   */
  private createServerInstance(sessionId: string): Server {
    const server = new Server(
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

    // Handle list tools request
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Listing available tools', { sessionId });
      return { tools };
    });

    // Handle tool execution
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logger.info('Executing tool', { sessionId, name, args });

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
          sessionId,
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

    return server;
  }

  /**
   * Create SSE transport for a client connection.
   * Each session gets its own Server instance (MCP SDK requirement).
   */
  async createTransport(sessionId: string, res: Response): Promise<SSEServerTransport> {
    logger.info('Creating SSE transport', { sessionId });

    // Start Swift bridge if not already started
    await swiftBridge.start();

    // Create a dedicated Server instance for this session
    const server = this.createServerInstance(sessionId);
    this.servers.set(sessionId, server);

    // Create transport with /messages as the endpoint for client messages
    const transport = new SSEServerTransport('/messages', res);

    // Connect the server to this transport
    await server.connect(transport);

    logger.info('SSE transport connected', { sessionId });

    return transport;
  }

  /**
   * Remove a session's server instance
   */
  async removeSession(sessionId: string): Promise<void> {
    const server = this.servers.get(sessionId);
    if (server) {
      await server.close();
      this.servers.delete(sessionId);
      logger.info('Session server closed', { sessionId });
    }
  }

  /**
   * Shutdown all server instances
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down MCP server manager');
    await swiftBridge.stop();
    for (const [sessionId, server] of this.servers) {
      await server.close();
      this.servers.delete(sessionId);
    }
  }
}

export default MCPServerManager;
