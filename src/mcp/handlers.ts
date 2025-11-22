import swiftBridge from '../utils/swift-bridge.js';
import logger from '../utils/logger.js';
import {
  listReminderListsSchema,
  createReminderListSchema,
  listRemindersSchema,
  createReminderSchema,
  updateReminderSchema,
  completeReminderSchema,
  deleteReminderSchema,
} from './tools.js';
import type { ToolHandler } from '../types.js';

/**
 * Handle list_reminder_lists tool
 */
export const handleListReminderLists: ToolHandler = async (params) => {
  const validated = listReminderListsSchema.parse(params);
  logger.debug('Listing reminder lists', validated);

  const response = await swiftBridge.execute({
    action: 'list_reminder_lists',
    params: validated,
  });

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to list reminder lists');
  }

  return response.data;
};

/**
 * Handle create_reminder_list tool
 */
export const handleCreateReminderList: ToolHandler = async (params) => {
  const validated = createReminderListSchema.parse(params);
  logger.debug('Creating reminder list', validated);

  const response = await swiftBridge.execute({
    action: 'create_reminder_list',
    params: validated,
  });

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to create reminder list');
  }

  return response.data;
};

/**
 * Handle list_reminders tool
 */
export const handleListReminders: ToolHandler = async (params) => {
  const validated = listRemindersSchema.parse(params);
  logger.debug('Listing reminders', validated);

  const response = await swiftBridge.execute({
    action: 'list_reminders',
    params: validated,
  });

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to list reminders');
  }

  return response.data;
};

/**
 * Handle create_reminder tool
 */
export const handleCreateReminder: ToolHandler = async (params) => {
  const validated = createReminderSchema.parse(params);
  logger.debug('Creating reminder', validated);

  const response = await swiftBridge.execute({
    action: 'create_reminder',
    params: validated,
  });

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to create reminder');
  }

  return response.data;
};

/**
 * Handle update_reminder tool
 */
export const handleUpdateReminder: ToolHandler = async (params) => {
  const validated = updateReminderSchema.parse(params);
  logger.debug('Updating reminder', validated);

  const response = await swiftBridge.execute({
    action: 'update_reminder',
    params: validated,
  });

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to update reminder');
  }

  return response.data;
};

/**
 * Handle complete_reminder tool
 */
export const handleCompleteReminder: ToolHandler = async (params) => {
  const validated = completeReminderSchema.parse(params);
  logger.debug('Completing reminder', validated);

  const response = await swiftBridge.execute({
    action: 'complete_reminder',
    params: validated,
  });

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to complete reminder');
  }

  return response.data;
};

/**
 * Handle delete_reminder tool
 */
export const handleDeleteReminder: ToolHandler = async (params) => {
  const validated = deleteReminderSchema.parse(params);
  logger.debug('Deleting reminder', validated);

  const response = await swiftBridge.execute({
    action: 'delete_reminder',
    params: validated,
  });

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to delete reminder');
  }

  return response.data;
};

// Map of tool names to handlers
export const toolHandlers: Record<string, ToolHandler> = {
  list_reminder_lists: handleListReminderLists,
  create_reminder_list: handleCreateReminderList,
  list_reminders: handleListReminders,
  create_reminder: handleCreateReminder,
  update_reminder: handleUpdateReminder,
  complete_reminder: handleCompleteReminder,
  delete_reminder: handleDeleteReminder,
};

export default toolHandlers;
