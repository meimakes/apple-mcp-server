import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import config from '../config.js';
import logger from './logger.js';
import { SwiftCommand, SwiftResponse } from '../types.js';

export class SwiftBridge {
  private process: ChildProcess | null = null;
  private isReady = false;
  private commandQueue: Array<{
    command: SwiftCommand;
    resolve: (value: SwiftResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];

  constructor() {
    this.ensureBinaryExists();
  }

  private ensureBinaryExists(): void {
    if (!existsSync(config.swiftBinaryPath)) {
      logger.error('Swift binary not found', { path: config.swiftBinaryPath });
      throw new Error(
        `Swift binary not found at ${config.swiftBinaryPath}. Run 'npm run build:swift' to build it.`
      );
    }
  }

  async start(): Promise<void> {
    if (this.process) {
      logger.warn('Swift process already running');
      return;
    }

    logger.info('Starting Swift EventKit bridge');

    this.process = spawn(config.swiftBinaryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let buffer = '';

    this.process.stdout?.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          this.handleResponse(line);
        }
      }
    });

    this.process.stderr?.on('data', (data) => {
      logger.error('Swift process error', { stderr: data.toString() });
    });

    this.process.on('error', (error) => {
      logger.error('Swift process error', { error: error.message });
      this.cleanup();
    });

    this.process.on('exit', (code) => {
      logger.info('Swift process exited', { code });
      this.cleanup();
    });

    this.isReady = true;
    logger.info('Swift EventKit bridge started');
  }

  private handleResponse(line: string): void {
    try {
      const response: SwiftResponse = JSON.parse(line);
      const item = this.commandQueue.shift();

      if (item) {
        clearTimeout(item.timeout);
        item.resolve(response);
      } else {
        logger.warn('Received response with no pending command', { response });
      }
    } catch (error) {
      logger.error('Failed to parse Swift response', {
        error: error instanceof Error ? error.message : 'Unknown error',
        line,
      });
    }
  }

  async execute<T = any>(command: SwiftCommand): Promise<SwiftResponse<T>> {
    if (!this.isReady || !this.process) {
      await this.start();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.commandQueue.findIndex((item) => item.resolve === resolve);
        if (index !== -1) {
          this.commandQueue.splice(index, 1);
        }
        reject(new Error(`Swift command timeout: ${command.action}`));
      }, config.swiftCommandTimeout);

      this.commandQueue.push({ command, resolve, reject, timeout });

      const commandStr = JSON.stringify(command) + '\n';
      logger.debug('Sending command to Swift', { command });

      this.process!.stdin?.write(commandStr, (error) => {
        if (error) {
          clearTimeout(timeout);
          const index = this.commandQueue.findIndex((item) => item.resolve === resolve);
          if (index !== -1) {
            this.commandQueue.splice(index, 1);
          }
          reject(error);
        }
      });
    });
  }

  private cleanup(): void {
    this.isReady = false;

    // Reject all pending commands
    for (const item of this.commandQueue) {
      clearTimeout(item.timeout);
      item.reject(new Error('Swift process terminated'));
    }
    this.commandQueue = [];

    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping Swift EventKit bridge');
    this.cleanup();
  }
}

// Singleton instance
export const swiftBridge = new SwiftBridge();
export default swiftBridge;
