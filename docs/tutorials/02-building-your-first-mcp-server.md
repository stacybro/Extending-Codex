# Chapter 2: Building Your First Codex MCP Server: A Task Manager from Scratch

In this chapter, you will build a local task manager that Codex can use through four MCP tools: `list_tasks`, `create_task`, `update_task`, and `complete_task`. You will put task rules in a small core, save tasks in a versioned JSON file, expose the operations through a stdio MCP server, and check the result with tests and natural-language requests. The code below comes from TaskHub Git commit **`29a1fea36a45b352b136413c9eae3fbf58d9be6c`**, whose [local integration milestone is recorded in the development journal](../development-journal.md#2026-11-07--local-codex-integration-verified). Run `git show 29a1fea` in a TaskHub checkout to inspect the exact commit.

You can follow this chapter in an empty directory. Every application and test code block below matches the original milestone commit, even if TaskHub's current branch has changed since then. It does not require Google credentials or a hosted database. The implementation supports one writer process and has no application-level sync.

## Prerequisites

- **Node.js 20 or newer** and npm. The milestone was tested locally with Node 24.18.1 and npm 11.16.0. The installed MCP server package requires Node 20 or newer.
- **Codex CLI**, installed and signed in, for the final registration and natural-language check. The code and automated tests can run before that step.
- **Git** to inspect the milestone. The local environment used Git 2.55.0 on Windows. You do not need Git to type the files below.
- **Windows:** PowerShell for the Windows commands below.
- **macOS or Linux:** Bash or zsh for the alternative setup and registration commands. The Node.js files and `npm` commands are the same on all three platforms.

Check your tools:

```powershell
node --version
npm --version
git --version
codex --version
```

## How MCP connects Codex to your code

MCP lets a host such as Codex discover tools published by a server. Each tool has a name, description, and input schema. Codex can select a tool and send arguments; the server validates and executes the call, then returns a result. For this chapter, Codex starts a local Node process and exchanges MCP messages over its standard input and output. [OpenAI's MCP server overview](https://developers.openai.com/plugins/concepts/mcp-server) explains this discovery and call sequence.

The server is an adapter, not the task manager itself:

```text
Codex -> stdio MCP server -> TaskHub core -> read/change store contract -> JSON file
```

The core owns task fields and operations. The JSON adapter owns file reads and writes. The MCP server owns tool names, schemas, descriptions, and protocol results. This separation allows another interface or storage adapter to use the same core later. The local implementation is recorded in [TaskHub's architecture overview](../architecture/overview.md) and [ADR 0002](../decisions/0002-local-json-and-mcp.md).

## 1. Create the project

On Windows, create a fresh project directory in PowerShell:

```powershell
New-Item -ItemType Directory -Force taskhub-mcp-demo | Out-Null
Set-Location taskhub-mcp-demo
New-Item -ItemType Directory -Force packages/core, integrations/codex, tests | Out-Null
```

On macOS or Linux, use Bash or zsh:

```sh
mkdir taskhub-mcp-demo && cd taskhub-mcp-demo
mkdir -p packages/core integrations/codex tests
```

Create `package.json` in the root:

```json
{
  "name": "taskhub",
  "private": true,
  "type": "module",
  "scripts": {
    "start:mcp": "node integrations/codex/server.js",
    "test": "node --test"
  },
  "dependencies": {
    "@modelcontextprotocol/server": "^2.0.0",
    "zod": "^4.0.0"
  }
}
```

Install dependencies:

```powershell
npm install
```

The milestone's lockfile resolved `@modelcontextprotocol/server` 2.4.0 and Zod 4.6.7. A fresh install may resolve newer compatible versions. For the exact milestone dependencies, copy its `package-lock.json` into your project and run `npm ci` instead.

Add `.gitignore` so local task data and installed packages stay out of commits:

```gitignore
node_modules/
.taskhub/
*.log
```

## 2. Build the task core

Create `packages/core/tasks.js`:

```javascript
import { randomUUID } from 'node:crypto';

export class TaskHub {
  constructor(store, { now = () => new Date().toISOString(), id = randomUUID } = {}) {
    this.store = store;
    this.now = now;
    this.id = id;
  }

  async list() {
    return this.store.read();
  }

  async create({ title, notes = '', dueDate = null }) {
    const cleanTitle = requiredText(title, 'title');
    const cleanNotes = optionalText(notes, 'notes');
    const cleanDueDate = dateOrNull(dueDate);
    const timestamp = this.now();
    const task = { id: this.id(), title: cleanTitle, notes: cleanNotes, dueDate: cleanDueDate,
      status: 'open', createdAt: timestamp, updatedAt: timestamp };
    await this.store.change(tasks => [...tasks, task]);
    return task;
  }

  async update({ id, title, notes, dueDate }) {
    const cleanId = requiredText(id, 'id');
    if (title === undefined && notes === undefined && dueDate === undefined) {
      throw new Error('Provide at least one field to update');
    }
    const changes = {};
    if (title !== undefined) changes.title = requiredText(title, 'title');
    if (notes !== undefined) changes.notes = optionalText(notes, 'notes');
    if (dueDate !== undefined) changes.dueDate = dateOrNull(dueDate);
    let updated;
    await this.store.change(tasks => tasks.map(task => {
      if (task.id !== cleanId) return task;
      updated = { ...task, ...changes, updatedAt: this.now() };
      return updated;
    }));
    if (!updated) throw new Error(`Task not found: ${cleanId}`);
    return updated;
  }

  async complete({ id }) {
    const cleanId = requiredText(id, 'id');
    let updated;
    await this.store.change(tasks => tasks.map(task => {
      if (task.id !== cleanId) return task;
      updated = task.status === 'completed' ? task : { ...task, status: 'completed', updatedAt: this.now() };
      return updated;
    }));
    if (!updated) throw new Error(`Task not found: ${cleanId}`);
    return updated;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be nonempty text`);
  return value.trim();
}

function optionalText(value, name) {
  if (typeof value !== 'string') throw new Error(`${name} must be text`);
  return value.trim();
}

function dateOrNull(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error('dueDate must be a real YYYY-MM-DD date or null');
  }
  return value;
}
```

`TaskHub` accepts a store and optional clock and ID functions. That keeps task behavior independent of both MCP and the file format. `create` validates fields before writing; `update` and `complete` report missing IDs. Completion is idempotent. A due date is data only: no Calendar operation occurs here.

The store contract has only `read()` and `change(transform)`. The core can therefore use a local file now and a different adapter later without moving task rules.

## 3. Save tasks in versioned JSON

Create `packages/core/json-file-store.js`:

```javascript
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export class JsonFileStore {
  constructor(path) {
    this.path = path;
    this.pending = Promise.resolve();
  }

  async read() {
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8'));
      if (data.version !== 1 || !Array.isArray(data.tasks)) throw new Error('Unsupported task data format');
      return data.tasks;
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async change(transform) {
    const run = this.pending.then(async () => {
      const tasks = await this.read();
      const next = transform(tasks);
      if (next === tasks || JSON.stringify(next) === JSON.stringify(tasks)) return;
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      try {
        const file = await open(temporary, 'wx', 0o600);
        try { await file.writeFile(JSON.stringify({ version: 1, tasks: next }, null, 2) + '\n'); }
        finally { await file.close(); }
        await replaceWithRetry(temporary, this.path);
      } catch (error) {
        await rm(temporary, { force: true });
        throw error;
      }
    });
    this.pending = run.catch(() => {});
    return run;
  }
}

async function replaceWithRetry(source, destination) {
  for (let attempt = 0; ; attempt++) {
    try { return await rename(source, destination); }
    catch (error) {
      if (error.code !== 'EPERM' || attempt === 5) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}
```

The file format is `{ "version": 1, "tasks": [...] }`. A missing file means an empty task list; an unsupported version is an error. `change` serializes calls through one store instance, writes a sibling temporary file, and renames it over the destination. The bounded retry handles transient Windows `EPERM` locks observed during local testing. It does **not** coordinate separate processes writing the same file.

## 4. Expose four MCP tools

Create `integrations/codex/server.js`:

```javascript
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
```

The four tool schemas define what Codex may send. The descriptions help Codex choose when to call each operation. `create_task` asks Codex to act only on an explicit create request, while `TaskHub.create` checks the task fields it receives. These are different checks: a direct caller can still invoke `create_task` with a title, because this local server cannot verify the original user utterance.

The server returns JSON as MCP text content and marks operation failures with `isError`. Keep ordinary logs off standard output: stdio uses that channel for protocol messages. The default data path is `.taskhub/tasks.json` relative to the server process's working directory; registration below sets an absolute path instead.

## 5. Add automated tests

Create `tests/tasks.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { TaskHub } from '../packages/core/tasks.js';
import { JsonFileStore } from '../packages/core/json-file-store.js';

async function fixture(t) {
  const testRoot = join(process.cwd(), '.taskhub', 'test');
  await mkdir(testRoot, { recursive: true });
  const directory = await mkdtemp(join(testRoot, 'run-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'tasks.json');
  const hub = new TaskHub(new JsonFileStore(path), { now: () => '2026-11-07T12:00:00.000Z' });
  return { hub, path };
}

test('create, list, update, complete and reload from a new store', async t => {
  const { hub, path } = await fixture(t);
  const created = await hub.create({ title: '  Buy milk  ', dueDate: '2026-11-09' });
  assert.match(created.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(created.status, 'open');
  assert.equal(created.createdAt, '2026-11-07T12:00:00.000Z');
  assert.deepEqual(await hub.list(), [created]);
  const updated = await hub.update({ id: created.id, notes: '2 percent' });
  assert.equal(updated.notes, '2 percent');
  const completed = await hub.complete({ id: created.id });
  assert.equal(completed.status, 'completed');
  assert.deepEqual(await new TaskHub(new JsonFileStore(path)).list(), [completed]);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).version, 1);
});

test('invalid inputs and missing IDs return useful errors without changing data', async t => {
  const { hub } = await fixture(t);
  await assert.rejects(hub.create({ title: '   ' }), /title must be nonempty/);
  await assert.rejects(hub.create({ title: 'x', dueDate: '2026-02-30' }), /dueDate must be/);
  await assert.rejects(hub.create({ title: 'x', notes: 4 }), /notes must be text/);
  await assert.rejects(hub.update({ id: 'missing' }), /at least one field/);
  await assert.rejects(hub.update({ id: 'missing', title: 'x' }), /Task not found/);
  await assert.rejects(hub.complete({ id: 'missing' }), /Task not found/);
  assert.deepEqual(await hub.list(), []);
});

test('concurrent changes through one store do not lose tasks', async t => {
  const { hub } = await fixture(t);
  await Promise.all(Array.from({ length: 12 }, (_, i) => hub.create({ title: `Task ${i}` })));
  assert.equal((await hub.list()).length, 12);
});
```

These tests cover create/list/update/complete, invalid fields and missing IDs, persistence through a new store instance, and concurrent calls through **one** store. Create `tests/mcp.test.js` to check protocol discovery and persistence after an MCP server restart:

```javascript
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
```

Run the same commands used for the local milestone:

```powershell
npm test
node --check integrations/codex/server.js
```

At milestone `29a1fea`, `npm test` passed **4 tests, 0 failed**, and `node --check` passed. Your run should show four passing tests if you copied the files and installed compatible dependencies. A failed run is evidence to investigate, not a reason to assume Codex registration works.

## 6. Register the server with Codex

From your new project root on Windows, register the Node script and an absolute data path in PowerShell:

```powershell
$taskhubRoot = (Get-Location).Path
$taskhubServer = Join-Path $taskhubRoot 'integrations\codex\server.js'
$taskhubData = Join-Path $taskhubRoot '.taskhub\tasks.json'
codex mcp add taskhub --env "TASKHUB_DATA_FILE=$taskhubData" -- node $taskhubServer
codex mcp list
```

On macOS or Linux, use Bash or zsh:

```sh
taskhub_root="$(pwd)"
codex mcp add taskhub --env "TASKHUB_DATA_FILE=$taskhub_root/.taskhub/tasks.json" -- node "$taskhub_root/integrations/codex/server.js"
codex mcp list
```

The TaskHub milestone registered the local server with `TASKHUB_DATA_FILE` pointing at its ignored `.taskhub/tasks.json` and confirmed that Codex exposed all four tools. The command above uses your own absolute paths. The current Codex CLI accepts `--env KEY=VALUE` for a stdio server; verify with `codex mcp add --help`. See the [official Codex MCP registration example](https://developers.openai.com/learn/docs-mcp) for the add/list workflow.

Start a **new Codex session** after registration, so it discovers the server. Ask, in order:

1. “List my TaskHub tasks.” Expect an empty list in a new data file.
2. “Add a task to review this tutorial.” Expect one open task with an ID.
3. “Change that task's notes to ‘Review and approve Chapter 2.’” Expect the same task with updated notes.
4. “Complete that task.” Expect its status to become `completed`.
5. “Show my open TaskHub tasks.” Expect none.

The milestone verified the same create/list/update/complete sequence locally with a Chapter 1 review task. It also checked that discussing “Buy groceries” as an example did not create a task. These observations demonstrate one local natural-language path; they do not prove every ambiguous request will be handled correctly.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `codex mcp list` does not show `taskhub` | Recheck the `codex mcp add` command, especially the server name and `--` before `node`. |
| Codex shows the server but no tools | Run `node --check integrations/codex/server.js` and `npm test`; check that `npm install` completed in this project. Start a new Codex session after fixing the server. |
| Data appears in an unexpected file | Inspect `TASKHUB_DATA_FILE` in the registration. Without it, the path depends on the server's working directory. |
| A file rename fails with `EPERM` on Windows | Keep data under an ignored local directory such as `.taskhub/`. The adapter retries transient locks, but persistent file access errors still need their cause resolved. |
| A tool returns an error | Inspect the tool's returned message. Empty titles, invalid dates, and unknown IDs are rejected by the core or schema. |

Do not run `npm run start:mcp` and type ordinary text into that terminal. A host such as Codex should launch the stdio process and exchange protocol messages with it.

## Security and limitations

This is a local single-user example. Keep `.taskhub/` out of Git: task data may be private. `.gitignore` does not encrypt the file or prevent a synced folder from copying it; choose its location and operating-system permissions accordingly. The `create_task` description and project instructions guide Codex to require an explicit request; the server does not independently prove intent. Its field validation is not user authentication or authorization. Before allowing shared or cloud writes, define identity, permissions, and concurrent-edit behavior, then enforce access on the server for each operation. [Official MCP guidance](https://developers.openai.com/plugins/build/mcp-server) likewise says not to rely on the model for authorization.

The JSON adapter serializes changes made through one store instance. It does not provide multi-process locking, sync, or cross-device conflict resolution. A due date does not schedule an event. Google Drive, Google Calendar, a reusable skill, and a visual dashboard are future milestones.

## Next steps

You now have a small working path from a Codex tool call to durable local task data. The next implementation chapter can examine the core contract and storage boundary in more detail, then the series can build on the verified MCP behavior. Keep the two forms of trust separate as you extend it: Codex interprets the user's request, while the application and server must enforce data and access rules.
