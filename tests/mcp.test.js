import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

test('MCP server lists tools and persists a task across process restarts', async t => {
  const root = join(process.cwd(), '.taskhub', 'test');
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(join(root, 'mcp-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'tasks.json');

  async function session() {
    const env = { ...process.env, TASKHUB_DATA_FILE: file };
    delete env.TASKHUB_STORAGE; // Exercise the default local mode.
    const child = spawn(process.execPath, ['integrations/codex/server.js'], {
      cwd: process.cwd(), env, stdio: ['pipe', 'pipe', 'pipe']
    });
    let buffer = '';
    const waiting = new Map();
    child.stdout.on('data', chunk => {
      buffer += chunk;
      for (let at; (at = buffer.indexOf('\n')) >= 0;) {
        const line = buffer.slice(0, at); buffer = buffer.slice(at + 1);
        if (!line) continue;
        const message = JSON.parse(line);
        if (waiting.has(message.id)) {
          waiting.get(message.id)(message);
          waiting.delete(message.id);
        }
      }
    });
    let nextId = 1;
    function request(method, params = {}) {
      const id = nextId++;
      const reply = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`MCP timeout: ${method}`)), 5000);
        waiting.set(id, value => { clearTimeout(timeout); resolve(value); });
      });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      return reply;
    }
    const init = await request('initialize', {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'taskhub-test', version: '1.0' }
    });
    assert.ok(init.result, JSON.stringify(init));
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    return { request, close: () => { child.stdin.end(); child.kill(); } };
  }

  const first = await session();
  t.after(first.close);
  const listed = await first.request('tools/list');
  assert.deepEqual(listed.result.tools.map(tool => tool.name).sort(),
    ['complete_task', 'create_task', 'list_tasks', 'update_task']);
  const createId = randomUUID();
  const created = await first.request('tools/call', { name: 'create_task', arguments: { operationId: createId, title: 'MCP task' } });
  assert.equal(created.result.isError, false);
  const task = created.result.structuredContent.data;
  assert.equal(created.result.structuredContent.ok, true);
  first.close();

  const second = await session();
  t.after(second.close);
  const tasks = await second.request('tools/call', { name: 'list_tasks', arguments: {} });
  assert.equal(tasks.result.structuredContent.data[0].id, task.id);
  const repeated = await second.request('tools/call', { name: 'create_task',
    arguments: { operationId: createId, title: 'MCP task' } });
  assert.deepEqual(repeated.result.structuredContent.data, task);
  const updated = await second.request('tools/call', { name: 'update_task',
    arguments: { operationId: randomUUID(), id: task.id, expectedRevision: 1, notes: 'Updated' } });
  assert.equal(updated.result.structuredContent.data.revision, 2);
  const conflict = await second.request('tools/call', { name: 'complete_task',
    arguments: { operationId: randomUUID(), id: task.id, expectedRevision: 1 } });
  assert.equal(conflict.result.structuredContent.error.code, 'CONFLICT');
  assert.equal(conflict.result.structuredContent.error.current.revision, 2);
  const missing = await second.request('tools/call', { name: 'complete_task',
    arguments: { operationId: randomUUID(), id: '00000000-0000-4000-8000-000000000000', expectedRevision: 1 } });
  assert.equal(missing.result.isError, true);
  assert.equal(missing.result.structuredContent.error.code, 'NOT_FOUND');
  const invalid = await second.request('tools/call', { name: 'create_task',
    arguments: { operationId: randomUUID(), title: '   ' } });
  assert.equal(invalid.result.isError, true);
  assert.equal(invalid.result.structuredContent.error.code, 'INVALID_INPUT');
});

test('Drive mode with missing file ID fails instead of falling back to local storage', () => {
  const result = spawnSync(process.execPath, ['integrations/codex/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, TASKHUB_STORAGE: 'drive', TASKHUB_DRIVE_FILE_ID: '', TASKHUB_DRIVE_ACCOUNT: 'personal' },
    encoding: 'utf8', timeout: 5000
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Drive file ID, authorization, and backup directory are required/);
});
