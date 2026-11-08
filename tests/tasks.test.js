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
