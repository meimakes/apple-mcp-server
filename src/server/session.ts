import { randomBytes } from 'crypto';
import config from '../config.js';
import logger from '../utils/logger.js';
import type { Session } from '../types.js';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTask();
  }

  /**
   * Create a new session
   */
  createSession(): Session {
    const id = randomBytes(16).toString('hex');
    const session: Session = {
      id,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.sessions.set(id, session);
    logger.info('Session created', { sessionId: id });

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /**
   * Update session activity
   */
  updateActivity(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Remove a session
   */
  removeSession(id: string): void {
    if (this.sessions.delete(id)) {
      logger.info('Session removed', { sessionId: id });
    }
  }

  /**
   * Start periodic cleanup of expired sessions
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Check every minute
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivity.getTime() > config.sessionTimeout) {
        this.sessions.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.info('Cleaned up expired sessions', { count: removedCount });
    }
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Stop the cleanup task
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const sessionManager = new SessionManager();
export default sessionManager;
