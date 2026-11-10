import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { TaskHub } from '../../packages/core/tasks.js';
import { JsonFileStore } from '../../packages/core/json-file-store.js';
import { DriveStore } from '../../packages/core/drive-store.js';
import { DriveTokenProvider } from '../drive/token-provider.js';
import { TaskHubError } from '../../packages/core/validation.js';

const mode = process.env.TASKHUB_STORAGE ?? 'local';
if (mode !== 'local' && mode !== 'drive') throw new TaskHubError('INVALID_CONFIG', 'TASKHUB_STORAGE must be local or drive');
const profileDir = join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'TaskHub');
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const credentialsFile = resolve(process.env.TASKHUB_DRIVE_CREDENTIALS_FILE ?? join(profileDir, 'drive-poc', 'oauth-client.json'));
const stateFile = resolve(process.env.TASKHUB_DRIVE_STATE_FILE ?? join(profileDir, 'drive-poc', 'poc-state.json'));
const backupDir = resolve(process.env.TASKHUB_DRIVE_BACKUP_DIR ?? join(profileDir, 'drive-backups'));
if (mode === 'drive') {
  for (const path of [credentialsFile, stateFile, backupDir]) {
    const inside = relative(repositoryRoot, path);
    if (inside !== '..' && !inside.startsWith('..' + sep) && !isAbsolute(inside))
      throw new TaskHubError('INVALID_CONFIG', 'Drive credentials, tokens, and backups must be outside the repository');
  }
}
const store = mode === 'local'
  ? new JsonFileStore(resolve(process.env.TASKHUB_DATA_FILE ?? '.taskhub/tasks.json'))
  : new DriveStore({
    fileId: process.env.TASKHUB_DRIVE_FILE_ID,
    backupDir,
    tokenProvider: new DriveTokenProvider({
      credentialsFile,
      stateFile,
      account: process.env.TASKHUB_DRIVE_ACCOUNT
    })
  });
if (mode === 'drive' && !['personal', 'work'].includes(process.env.TASKHUB_DRIVE_ACCOUNT))
  throw new TaskHubError('INVALID_CONFIG', 'TASKHUB_DRIVE_ACCOUNT must be personal or work');
const tasks = new TaskHub(store);
// Core validation owns application errors so all tool calls share one response shape.
const operationId = z.unknown().describe('UUID, stable across retries of this write');
const taskId = z.unknown().describe('Task UUID from list_tasks');
const expectedRevision = z.unknown().describe('Current positive integer revision from list_tasks');
const title = z.unknown().describe('Nonempty title, at most 200 characters');
const notes = z.unknown().describe('Text, at most 10000 characters');
const dueDate = z.unknown().describe('Real YYYY-MM-DD date or null');

function response(body, isError = false) {
  return { isError, content: [{ type: 'text', text: JSON.stringify(body) }], structuredContent: body };
}
function handler(operation) {
  return async input => {
    try { return response({ ok: true, data: await operation(input) }); }
    catch (error) {
      const safe = error instanceof TaskHubError ? error :
        new TaskHubError('STORAGE_ERROR', 'Task operation failed');
      return response({ ok: false, error: { code: safe.code, message: safe.message, ...safe.details } }, true);
    }
  };
}
serveStdio(() => {
  const server = new McpServer({ name: 'taskhub', version: '0.2.0',
    instructions: 'Only create tasks on explicit user request. Never save examples or hypothetical tasks. Before update or complete, list tasks to obtain the current revision; the user need not provide it. Use a fresh UUID operationId for each new write and reuse it unchanged for retries. On CONFLICT, explain the current state and ask before retrying. On DRIVE_CHANGED, list again before attempting a new write. On OUTCOME_UNKNOWN, do not start a new operation until the saved operation ID is checked. A due date never schedules an event.' });
  server.registerTool('list_tasks', {
    description: 'List saved TaskHub tasks, including their current revisions. Read only.',
    inputSchema: z.object({})
  }, handler(() => tasks.list()));
  server.registerTool('create_task', {
    description: 'Create a task ONLY on explicit user request. Never create examples. Generate a UUID operationId once per requested write and reuse it on retries.',
    inputSchema: z.object({ operationId, title, notes: notes.optional(), dueDate: dueDate.optional() }).passthrough()
  }, handler(input => tasks.create(input)));
  server.registerTool('update_task', {
    description: 'Update a task after an explicit request. First list tasks to obtain expectedRevision. Generate a UUID operationId once and reuse it on retries. On conflict, do not overwrite.',
    inputSchema: z.object({ operationId, id: taskId, expectedRevision, title: title.optional(),
      notes: notes.optional(), dueDate: dueDate.optional() }).passthrough()
  }, handler(input => tasks.update(input)));
  server.registerTool('complete_task', {
    description: 'Complete a task after an explicit request. First list tasks to obtain expectedRevision. Generate a UUID operationId once and reuse it on retries. On conflict, do not overwrite.',
    inputSchema: z.object({ operationId, id: taskId, expectedRevision }).passthrough()
  }, handler(input => tasks.complete(input)));
  return server;
});
