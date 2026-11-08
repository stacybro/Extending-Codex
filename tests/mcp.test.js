import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

test('MCP server lists tools and persists a task across process restarts', async t => {
  const root = join(process.cwd(), '.taskhub', 'test');
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(join(root, 'mcp-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'tasks.json');

  async function session() {
    const child = spawn(process.execPath, ['integrations/codex/server.js'], {
      cwd: process.cwd(), env: { ...process.env, TASKHUB_DATA_FILE: file }, stdio: ['pipe', 'pipe', 'pipe']
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
  const created = await first.request('tools/call', { name: 'create_task', arguments: { title: 'MCP task' } });
  assert.equal(created.result.isError, undefined);
  const task = JSON.parse(created.result.content[0].text);
  first.close();

  const second = await session();
  t.after(second.close);
  const tasks = await second.request('tools/call', { name: 'list_tasks', arguments: {} });
  assert.equal(JSON.parse(tasks.result.content[0].text)[0].id, task.id);
  const missing = await second.request('tools/call', { name: 'complete_task',
    arguments: { id: '00000000-0000-4000-8000-000000000000' } });
  assert.equal(missing.result.isError, true);
});
