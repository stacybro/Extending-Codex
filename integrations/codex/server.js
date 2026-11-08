import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { TaskHub } from '../../packages/core/tasks.js';
import { JsonFileStore } from '../../packages/core/json-file-store.js';

const dataFile = resolve(process.env.TASKHUB_DATA_FILE ?? '.taskhub/tasks.json');
const tasks = new TaskHub(new JsonFileStore(dataFile));

function result(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

function handler(operation) {
  return async input => {
    try { return result(await operation(input)); }
    catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; }
  };
}

serveStdio(() => {
  const server = new McpServer({ name: 'taskhub', version: '0.1.0' });

  server.registerTool('list_tasks', {
    description: 'List saved TaskHub tasks. Use this to inspect tasks without changing them.',
    inputSchema: z.object({})
  }, handler(() => tasks.list()));

  server.registerTool('create_task', {
    description: 'Create and save a task ONLY when the user explicitly asks to create or add it. Never call for examples, hypothetical discussion, or tutorial content. A due date never schedules a calendar event.',
    inputSchema: z.object({
      title: z.string().min(1),
      notes: z.string().optional(),
      dueDate: z.iso.date().nullable().optional()
    })
  }, handler(input => tasks.create(input)));

  server.registerTool('update_task', {
    description: 'Update fields of an existing task by ID after an explicit user request. This does not schedule an event.',
    inputSchema: z.object({
      id: z.uuid(),
      title: z.string().min(1).optional(),
      notes: z.string().optional(),
      dueDate: z.iso.date().nullable().optional()
    })
  }, handler(input => tasks.update(input)));

  server.registerTool('complete_task', {
    description: 'Mark an existing task completed by ID after an explicit user request.',
    inputSchema: z.object({ id: z.uuid() })
  }, handler(input => tasks.complete(input)));

  return server;
});
