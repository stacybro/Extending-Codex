import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DriveStore } from '../packages/core/drive-store.js';
import { TaskHub } from '../packages/core/tasks.js';

const empty = () => ({ version: 2, storeRevision: 0, tasks: [], operations: {} });

async function fixture(t) {
  const root = join(process.cwd(), '.taskhub', 'test');
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(join(root, 'drive-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const remote = { document: empty(), version: 1, calls: [], fail: null, beforeCheck: null };
  const fetchImpl = async (url, options = {}) => {
    const path = new URL(url).pathname;
    const method = options.method ?? 'GET';
    remote.calls.push(`${method} ${path}`);
    if (remote.fail === 'offline') throw new Error('offline');
    if (method === 'GET' && path.endsWith('/files/test-file')) {
      if (remote.beforeCheck && remote.calls.filter(call => call.endsWith('/files/test-file')).length === 2)
        remote.beforeCheck();
      return new Response(JSON.stringify({ id: 'test-file', version: String(remote.version), mimeType: 'application/json', trashed: false }));
    }
    if (method === 'PATCH') {
      remote.document = JSON.parse(options.body);
      remote.version++;
      if (remote.fail === 'uncertain') throw new Error('timeout after upload');
      if (remote.fail === 'uncertain-unreadable') { remote.fail = 'offline'; throw new Error('timeout after upload'); }
      return new Response('{}');
    }
    return new Response('not found', { status: 404 });
  };
  // Query parameters distinguish file metadata from media at the same path.
  const api = async (url, options) => {
    if (url.includes('alt=media')) {
      remote.calls.push('GET media');
      return new Response(JSON.stringify(remote.document));
    }
    return fetchImpl(url, options);
  };
  const store = new DriveStore({ fileId: 'test-file', tokenProvider: { token: async () => 'token' },
    backupDir: join(dir, 'backups'), fetchImpl: api });
  const hub = new TaskHub(store, { now: () => '2026-11-09T12:00:00.000Z' });
  return { remote, store, hub, dir };
}

test('Drive store supports all task operations and saves validated pre-write backups', async t => {
  const { remote, hub, store, dir } = await fixture(t);
  assert.deepEqual(await hub.list(), []);
  const created = await hub.create({ operationId: randomUUID(), title: 'Disposable' });
  assert.equal((await hub.list())[0].id, created.id);
  const updated = await hub.update({ operationId: randomUUID(), id: created.id, expectedRevision: 1, notes: 'Work' });
  const completed = await hub.complete({ operationId: randomUUID(), id: created.id, expectedRevision: 2 });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.revision, 3);
  assert.equal(updated.revision, 2);
  assert.equal(remote.document.storeRevision, 3);
  const backups = await readdir(join(dir, 'backups'));
  assert.equal(backups.length, 3);
  const images = await Promise.all(backups.map(async name => JSON.parse(await readFile(join(dir, 'backups', name), 'utf8'))));
  assert.ok(images.some(image => image.tasks.length === 0));
  assert.equal((await store.read()).tasks[0].status, 'completed');
});

test('Drive store stops when a newer version appears before upload', async t => {
  const { remote, hub } = await fixture(t);
  remote.beforeCheck = () => { remote.version++; };
  await assert.rejects(hub.create({ operationId: randomUUID(), title: 'No overwrite' }), { code: 'DRIVE_CHANGED' });
  assert.equal(remote.calls.some(call => call.startsWith('PATCH')), false);
  assert.deepEqual(remote.document.tasks, []);
});

test('Drive store rejects malformed records and does not upload', async t => {
  const { remote, hub } = await fixture(t);
  remote.document = { version: 2, storeRevision: 0, tasks: [{ title: 'bad' }], operations: {} };
  await assert.rejects(hub.list(), { code: 'DATA_CORRUPT' });
  await assert.rejects(hub.create({ operationId: randomUUID(), title: 'Blocked' }), { code: 'DATA_CORRUPT' });
  assert.equal(remote.calls.some(call => call.startsWith('PATCH')), false);
});

test('Drive store fails before cloud upload if local backup cannot be written', async t => {
  const { remote, hub, store, dir } = await fixture(t);
  const file = join(dir, 'not-a-directory');
  await writeFile(file, 'x');
  store.backupDir = file;
  await assert.rejects(hub.create({ operationId: randomUUID(), title: 'Blocked' }), { code: 'BACKUP_FAILED' });
  assert.equal(remote.calls.some(call => call.startsWith('PATCH')), false);
});

test('uncertain Drive write is resolved by the durable operation ledger without a second upload', async t => {
  const { remote, hub } = await fixture(t);
  remote.fail = 'uncertain';
  const task = await hub.create({ operationId: randomUUID(), title: 'Maybe saved' });
  assert.equal(task.title, 'Maybe saved');
  assert.equal(remote.calls.filter(call => call.startsWith('PATCH')).length, 1);
  assert.equal((await hub.list()).length, 1);
});

test('Drive read fails clearly while offline', async t => {
  const { remote, hub } = await fixture(t);
  remote.fail = 'offline';
  await assert.rejects(hub.list(), { code: 'DRIVE_UNAVAILABLE' });
});

test('unverifiable uncertain write remains explicit and is not retried', async t => {
  const { remote, hub } = await fixture(t);
  remote.fail = 'uncertain-unreadable';
  await assert.rejects(hub.create({ operationId: randomUUID(), title: 'May be saved' }), { code: 'OUTCOME_UNKNOWN' });
  assert.equal(remote.calls.filter(call => call.startsWith('PATCH')).length, 1);
});

test('Drive authorization, permission, and missing-file errors are distinct', async t => {
  const { store } = await fixture(t);
  for (const [status, code] of [[401, 'UNAUTHORIZED'], [403, 'FORBIDDEN'], [404, 'DRIVE_FILE_UNAVAILABLE']]) {
    store.fetch = async () => new Response('', { status });
    await assert.rejects(store.read(), { code });
  }
});
