// Swift bridge types
export interface SwiftCommand {
  action: string;
  params?: Record<string, any>;
}

export interface SwiftResponse<T = any> {
  success: boolean;
  data?: T;
  error?: SwiftError;
}

export interface SwiftError {
  code: string;
  message: string;
}

// Reminder types
export interface ReminderList {
  id: string;
  name: string;
  color?: string;
  count: number;
}

export interface Reminder {
  id: string;
  title: string;
  notes?: string;
  listId: string;
  listName: string;
  completed: boolean;
  dueDate?: string; // ISO 8601
  dueDateIncludesTime?: boolean;
  priority: number; // 0=none, 1=high, 5=medium, 9=low
  url?: string;
  creationDate: string;
  modificationDate: string;
}

// Tool input types
export interface ListRemindersParams {
  listId?: string;
  listName?: string;
  showCompleted?: boolean;
  dueWithin?: 'today' | 'tomorrow' | 'this-week' | 'overdue' | 'no-date';
  search?: string;
}

export interface CreateReminderParams {
  title: string;
  listId?: string;
  listName?: string;
  notes?: string;
  dueDate?: string;
  dueDateIncludesTime?: boolean;
  priority?: number;
  url?: string;
}

export interface UpdateReminderParams {
  id: string;
  title?: string;
  notes?: string | null;
  dueDate?: string | null;
  dueDateIncludesTime?: boolean;
  priority?: number;
  url?: string | null;
  moveToListId?: string;
}

export interface CompleteReminderParams {
  id: string;
  completed: boolean;
}

export interface DeleteReminderParams {
  id: string;
}

export interface CreateReminderListParams {
  name: string;
  color?: string;
}

// Session types
export interface Session {
  id: string;
  createdAt: Date;
  lastActivity: Date;
}

// MCP types (from SDK)
export type ToolHandler = (params: any) => Promise<any>;
