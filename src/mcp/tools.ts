import { z } from 'zod';

// Tool schemas
export const listReminderListsSchema = z.object({});

export const createReminderListSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  color: z.string().optional(),
});

export const listRemindersSchema = z.object({
  listId: z.string().optional(),
  listName: z.string().optional(),
  showCompleted: z.boolean().optional().default(false),
  dueWithin: z
    .enum(['today', 'tomorrow', 'this-week', 'overdue', 'no-date'])
    .optional(),
  search: z.string().optional(),
});

export const createReminderSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  listId: z.string().optional(),
  listName: z.string().optional(),
  notes: z.string().optional(),
  dueDate: z.string().optional(), // ISO 8601
  dueDateIncludesTime: z.boolean().optional(),
  priority: z.number().min(0).max(9).optional().default(0),
  url: z.string().url().optional().or(z.literal('')),
});

export const updateReminderSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  title: z.string().optional(),
  notes: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  dueDateIncludesTime: z.boolean().optional(),
  priority: z.number().min(0).max(9).optional(),
  url: z.string().url().nullable().optional().or(z.literal('')),
  moveToListId: z.string().optional(),
});

export const completeReminderSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  completed: z.boolean(),
});

export const deleteReminderSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

// Tool definitions for MCP
export const tools = [
  {
    name: 'list_reminder_lists',
    description: 'Get all reminder lists available in Apple Reminders',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_reminder_list',
    description: 'Create a new reminder list',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the reminder list',
        },
        color: {
          type: 'string',
          description: 'Color for the list (optional)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_reminders',
    description:
      'List reminders with optional filtering by list, completion status, due date, or search text',
    inputSchema: {
      type: 'object',
      properties: {
        listId: {
          type: 'string',
          description: 'Filter by list ID',
        },
        listName: {
          type: 'string',
          description: 'Filter by list name',
        },
        showCompleted: {
          type: 'boolean',
          description: 'Include completed reminders (default: false)',
        },
        dueWithin: {
          type: 'string',
          enum: ['today', 'tomorrow', 'this-week', 'overdue', 'no-date'],
          description: 'Filter by due date range',
        },
        search: {
          type: 'string',
          description: 'Search text in title or notes',
        },
      },
    },
  },
  {
    name: 'create_reminder',
    description: 'Create a new reminder in Apple Reminders',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the reminder',
        },
        listId: {
          type: 'string',
          description: 'ID of the list to add the reminder to',
        },
        listName: {
          type: 'string',
          description: 'Name of the list to add the reminder to',
        },
        notes: {
          type: 'string',
          description: 'Additional notes for the reminder',
        },
        dueDate: {
          type: 'string',
          description: 'Due date in ISO 8601 format',
        },
        dueDateIncludesTime: {
          type: 'boolean',
          description: 'Whether the due date includes a specific time',
        },
        priority: {
          type: 'number',
          description: 'Priority: 0=none, 1=high, 5=medium, 9=low',
          minimum: 0,
          maximum: 9,
        },
        url: {
          type: 'string',
          description: 'URL associated with the reminder',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_reminder',
    description: 'Update an existing reminder',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the reminder to update',
        },
        title: {
          type: 'string',
          description: 'New title',
        },
        notes: {
          type: ['string', 'null'],
          description: 'New notes (null to clear)',
        },
        dueDate: {
          type: ['string', 'null'],
          description: 'New due date in ISO 8601 format (null to clear)',
        },
        dueDateIncludesTime: {
          type: 'boolean',
          description: 'Whether the due date includes a specific time',
        },
        priority: {
          type: 'number',
          description: 'New priority: 0=none, 1=high, 5=medium, 9=low',
          minimum: 0,
          maximum: 9,
        },
        url: {
          type: ['string', 'null'],
          description: 'New URL (null to clear)',
        },
        moveToListId: {
          type: 'string',
          description: 'ID of list to move reminder to',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'complete_reminder',
    description: 'Mark a reminder as complete or incomplete',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the reminder',
        },
        completed: {
          type: 'boolean',
          description: 'Whether to mark as completed',
        },
      },
      required: ['id', 'completed'],
    },
  },
  {
    name: 'delete_reminder',
    description: 'Delete a reminder permanently',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID of the reminder to delete',
        },
      },
      required: ['id'],
    },
  },
] as const;

export default tools;
