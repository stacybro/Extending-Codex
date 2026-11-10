// Exercises the four existing MCP tools against the disposable Drive store only.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const account = process.argv[2];
if (!['personal', 'work'].includes(account)) throw new Error('Choose personal or work.');
const root = process.env.TASKHUB_DRIVE_POC_HOME ??
  join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'TaskHub', 'drive-poc');
const state = JSON.parse(await readFile(join(root, 'poc-state.json'), 'utf8'));
if (!state.storeFileId || !state.accounts?.[account]) throw new Error('Disposable store or account authorization is missing.');

const child = spawn(process.execPath, ['integrations/codex/server.js'], {
  cwd: process.cwd(),
  env: { ...process.env, TASKHUB_STORAGE: 'drive', TASKHUB_DRIVE_FILE_ID: state.storeFileId,
    TASKHUB_DRIVE_ACCOUNT: account, TASKHUB_DRIVE_CREDENTIALS_FILE: join(root, 'oauth-client.json'),
    TASKHUB_DRIVE_STATE_FILE: join(root, 'poc-state.json'),
    TASKHUB_DRIVE_BACKUP_DIR: join(root, 'backups', account) },
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';
let nextId = 1;
const pending = new Map();
child.stdout.on('data', chunk => {
  buffer += chunk;
  for (let at; (at = buffer.indexOf('\n')) >= 0;) {
    const line = buffer.slice(0, at); buffer = buffer.slice(at + 1);
    if (!line) continue;
    const response = JSON.parse(line);
    const waiter = pending.get(response.id);
    if (waiter) { pending.delete(response.id); waiter(response); }
  }
});
child.on('exit', () => {
  for (const waiter of pending.values()) waiter({ error: { message: 'MCP server exited' } });
  pending.clear();
});
function request(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`MCP ${method} timed out`)); }, 45000);
    pending.set(id, result => { clearTimeout(timer); resolve(result); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
async function call(name, args = {}) {
  const result = await request('tools/call', { name, arguments: args });
  const body = result.result?.structuredContent;
  if (!body?.ok) {
    const error = new Error(`${name}: ${body?.error?.code ?? result.error?.message ?? 'unknown error'}: ${body?.error?.message ?? ''} ${body?.error?.expectedVersion ?? ''}->${body?.error?.currentVersion ?? ''}`);
    error.code = body?.error?.code;
    throw error;
  }
  return body.data;
}
async function writeAfterReload(name, args) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try { return await call(name, args); }
    catch (error) {
      if (error.code !== 'DRIVE_CHANGED' || attempt === 4) throw error;
      const current = await call('list_tasks');
      if (args.id && current.find(task => task.id === args.id)?.revision !== args.expectedRevision)
        throw new Error('Task revision changed; refusing to retry the write');
      console.log(`${account} reloaded after Drive version changed; retrying ${name} with the same operation ID.`);
    }
  }
}
function idFor(kind) {
  const hex = createHash('sha256').update(`${state.storeFileId}:${account}:${kind}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

try {
  const init = await request('initialize', {
    protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'drive-verification', version: '1' }
  });
  if (!init.result) throw new Error('MCP initialization failed');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const tools = await request('tools/list');
  const names = tools.result?.tools?.map(tool => tool.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(['complete_task', 'create_task', 'list_tasks', 'update_task']))
    throw new Error('The four expected MCP tools were not exposed');
  const before = await call('list_tasks');
  const peer = account === 'personal' ? 'work' : 'personal';
  if (!before.some(task => task.title === `Drive verification ${peer}`))
    throw new Error(`${account} cannot see the ${peer} account's disposable task`);
  const created = await writeAfterReload('create_task', { operationId: idFor('create'), title: `Drive verification ${account}` });
  const visible = await call('list_tasks');
  if (!visible.some(task => task.id === created.id)) throw new Error('Created task was not visible to list_tasks');
  const updated = await writeAfterReload('update_task', { operationId: idFor('update'), id: created.id,
    expectedRevision: 1, notes: `Verified by ${account} MCP client` });
  const completed = await writeAfterReload('complete_task', { operationId: idFor('complete'), id: created.id,
    expectedRevision: 2 });
  if (updated.revision !== 2 || completed.revision !== 3 || completed.status !== 'completed')
    throw new Error('Update or completion returned an unexpected task');
  const after = await call('list_tasks');
  if (!after.some(task => task.id === completed.id && task.status === 'completed'))
    throw new Error('Completed task was not visible to list_tasks');
  console.log(JSON.stringify({ account, tools: names, beforeCount: before.length,
    afterCount: after.length, completedTaskId: completed.id, storeFileId: state.storeFileId }));
} finally {
  child.stdin.end();
  child.kill();
}
