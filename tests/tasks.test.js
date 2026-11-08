import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { TaskHub } from '../packages/core/tasks.js';
import { JsonFileStore } from '../packages/core/json-file-store.js';
import { TaskHubError } from '../packages/core/validation.js';

async function fixture(t) {
  const root = join(process.cwd(), '.taskhub', 'test');
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(join(root, 'run-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'tasks.json');
  const store = new JsonFileStore(path);
  const hub = new TaskHub(store, { now: () => '2026-11-07T12:00:00.000Z' });
  return { hub, store, path };
}

test('create, list, update, complete, backup, and restart', async t => {
  const { hub, path } = await fixture(t);
  const created = await hub.create({ operationId: randomUUID(), title: ' Buy milk ', dueDate: '2026-11-09' });
  assert.equal(created.title, 'Buy milk');
  assert.equal(created.revision, 1);
  assert.equal(created.status, 'open');
  const updated = await hub.update({ operationId: randomUUID(), id: created.id, expectedRevision: 1, notes: '2 percent' });
  assert.equal(updated.revision, 2);
  const completed = await hub.complete({ operationId: randomUUID(), id: created.id, expectedRevision: 2 });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.revision, 3);
  assert.deepEqual(await new TaskHub(new JsonFileStore(path)).list(), [completed]);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).version, 2);
  assert.equal((await readFile(path + '.bak', 'utf8')).includes('2 percent'), true);
});

test('every write is idempotent and rejects operation ID reuse with different arguments', async t => {
  const { hub } = await fixture(t);
  const createId = randomUUID();
  const first = await hub.create({ operationId: createId, title: ' Task ' });
  assert.deepEqual(await hub.create({ operationId: createId, title: 'Task' }), first);
  assert.deepEqual(await hub.create({ operationId: createId.toUpperCase(), title: 'Task' }), first);
  await assert.rejects(hub.create({ operationId: createId, title: 'Different' }), { code: 'OPERATION_ID_REUSED' });
  const updateId = randomUUID();
  const updated = await hub.update({ operationId: updateId, id: first.id, expectedRevision: 1, notes: 'hi' });
  assert.deepEqual(await hub.update({ operationId: updateId, id: first.id, expectedRevision: 1, notes: 'hi' }), updated);
  await assert.rejects(hub.update({ operationId: updateId, id: first.id, expectedRevision: 1, notes: 'bye' }), { code: 'OPERATION_ID_REUSED' });
  const completeId = randomUUID();
  const done = await hub.complete({ operationId: completeId, id: first.id, expectedRevision: 2 });
  assert.deepEqual(await hub.complete({ operationId: completeId, id: first.id, expectedRevision: 2 }), done);
  await assert.rejects(hub.complete({ operationId: completeId, id: first.id, expectedRevision: 3 }), { code: 'OPERATION_ID_REUSED' });
  assert.equal((await hub.list()).length, 1);
  assert.equal((await hub.list())[0].revision, 3);
});

test('stale revisions conflict without overwriting and missing IDs fail', async t => {
  const { hub } = await fixture(t);
  const task = await hub.create({ operationId: randomUUID(), title: 'A' });
  await hub.update({ operationId: randomUUID(), id: task.id, expectedRevision: 1, title: 'B' });
  await assert.rejects(hub.update({ operationId: randomUUID(), id: task.id, expectedRevision: 1, title: 'C' }),
    error => error.code === 'CONFLICT' && error.details.current.title === 'B');
  await assert.rejects(hub.complete({ operationId: randomUUID(), id: randomUUID(), expectedRevision: 1 }), { code: 'NOT_FOUND' });
  assert.equal((await hub.list())[0].title, 'B');
});

test('version 1 is read and migrated on first successful write, preserving fields', async t => {
  const { hub, path } = await fixture(t);
  const old = { id: randomUUID(), title: 'Old', notes: '', dueDate: null, status: 'open',
    createdAt: '2026-11-07T10:00:00.000Z', updatedAt: '2026-11-07T10:00:00.000Z' };
  const source = JSON.stringify({ version: 1, tasks: [old] });
  await writeFile(path, source);
  assert.deepEqual(await hub.list(), [{ ...old, revision: 1 }]);
  assert.equal(await readFile(path, 'utf8'), source);
  await hub.complete({ operationId: randomUUID(), id: old.id, expectedRevision: 1 });
  const stored = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(stored.version, 2);
  assert.equal(stored.tasks[0].id, old.id);
  assert.equal(stored.tasks[0].createdAt, old.createdAt);
  assert.equal(JSON.parse(await readFile(path + '.bak', 'utf8')).version, 1);
});

test('corrupt data is never replaced with an empty list; backup remains inspectable', async t => {
  const { hub, store, path } = await fixture(t);
  await hub.create({ operationId: randomUUID(), title: 'Safe' });
  await hub.create({ operationId: randomUUID(), title: 'Another' });
  await writeFile(path, '{broken');
  await assert.rejects(hub.list(), { code: 'DATA_CORRUPT' });
  await assert.rejects(hub.create({ operationId: randomUUID(), title: 'No write' }), { code: 'DATA_CORRUPT' });
  assert.equal(await readFile(path, 'utf8'), '{broken');
  assert.equal((await store.readBackup()).tasks.length, 1);
});

test('missing primary with backup requires explicit recovery', async t => {
  const { hub, path, store } = await fixture(t);
  await hub.create({ operationId: randomUUID(), title: 'Original' });
  await hub.create({ operationId: randomUUID(), title: 'Next' });
  await rm(path);
  await assert.rejects(hub.list(), { code: 'RECOVERY_REQUIRED' });
  await assert.rejects(hub.create({ operationId: randomUUID(), title: 'Never saved' }), { code: 'RECOVERY_REQUIRED' });
  assert.equal((await store.readBackup()).tasks[0].title, 'Original');
});

test('malformed version 1 task and operation ledger are rejected', async t => {
  const { hub, path } = await fixture(t);
  await writeFile(path, JSON.stringify({ version: 1, tasks: [{ id: randomUUID(), title: 'Incomplete' }] }));
  await assert.rejects(hub.list(), { code: 'DATA_CORRUPT' });
  await writeFile(path, JSON.stringify({ version: 2, storeRevision: 1, tasks: [], operations: { bad: {} } }));
  await assert.rejects(hub.list(), { code: 'DATA_CORRUPT' });
});

test('validation, lock conflict, and persistence failure', async t => {
  const { hub, path } = await fixture(t);
  await assert.rejects(hub.create({ operationId: randomUUID(), title: ' ' }), { code: 'INVALID_INPUT' });
  await assert.rejects(hub.create({ operationId: randomUUID(), title: 'x', dueDate: '2026-02-30' }), { code: 'INVALID_INPUT' });
  await assert.rejects(hub.create({ operationId: randomUUID(), title: 'x'.repeat(201) }), { code: 'INVALID_INPUT' });
  await writeFile(path + '.lock', 'locked');
  await assert.rejects(hub.create({ operationId: randomUUID(), title: 'Locked' }), { code: 'STORE_LOCKED' });
  await rm(path + '.lock');
  const task = await hub.create({ operationId: randomUUID(), title: 'Saved' });
  await writeFile(path + '.bak', 'old backup');
  await rm(path + '.bak');
  await mkdir(path + '.bak');
  await assert.rejects(hub.update({ operationId: randomUUID(), id: task.id, expectedRevision: 1, title: 'Failed' }));
  assert.equal((await hub.list())[0].title, 'Saved');
});

test('uncertain outcome resolves from persisted operation or remains explicit', async () => {
  const operationId = randomUUID();
  const saved = { id: randomUUID(), title: 'Recovered' };
  let document = { version: 2, storeRevision: 0, tasks: [], operations: {} };
  let persist = true;
  const store = {
    async read() { return document; },
    async transact(transform) {
      if (persist) transform(document);
      throw new TaskHubError('OUTCOME_UNKNOWN', 'Write outcome is unknown');
    }
  };
  const hub = new TaskHub(store, { id: () => saved.id });
  const recovered = await hub.create({ operationId, title: 'Recovered' });
  assert.equal(recovered.id, saved.id);
  document = { version: 2, storeRevision: 0, tasks: [], operations: {} };
  persist = false;
  await assert.rejects(hub.create({ operationId: randomUUID(), title: 'Not confirmed' }), { code: 'OUTCOME_UNKNOWN' });
});
