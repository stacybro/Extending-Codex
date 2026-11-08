import { randomUUID } from 'node:crypto';
import { TaskHubError, normalizeCreate, normalizeUpdate, uuid, revision } from './validation.js';

export class TaskHub {
  constructor(store, { now = () => new Date().toISOString(), id = randomUUID } = {}) {
    this.store = store;
    this.now = now;
    this.id = id;
  }
  async list() { return (await this.store.read()).tasks; }
  async create({ operationId, ...input }) {
    operationId = uuid(operationId, 'operationId');
    const args = normalizeCreate(input);
    return this.write(operationId, 'create', args, doc => {
      const stamp = this.now();
      const task = { id: this.id(), ...args, status: 'open', revision: 1, createdAt: stamp, updatedAt: stamp };
      doc.tasks.push(task);
      return task;
    });
  }
  async update({ operationId, id, expectedRevision, ...input }) {
    operationId = uuid(operationId, 'operationId'); id = uuid(id, 'id'); revision(expectedRevision, 'expectedRevision');
    const changes = normalizeUpdate(input);
    const args = { id, expectedRevision, ...changes };
    return this.write(operationId, 'update', args, doc => {
      const index = findTask(doc, id, expectedRevision);
      const task = { ...doc.tasks[index], ...changes, revision: doc.tasks[index].revision + 1, updatedAt: this.now() };
      doc.tasks[index] = task;
      return task;
    });
  }
  async complete({ operationId, id, expectedRevision, ...extra }) {
    if (Object.keys(extra).length) throw new TaskHubError('INVALID_INPUT', 'Unsupported input field');
    operationId = uuid(operationId, 'operationId'); id = uuid(id, 'id'); revision(expectedRevision, 'expectedRevision');
    const args = { id, expectedRevision };
    return this.write(operationId, 'complete', args, doc => {
      const index = findTask(doc, id, expectedRevision);
      const current = doc.tasks[index];
      const task = current.status === 'completed' ? current :
        { ...current, status: 'completed', revision: current.revision + 1, updatedAt: this.now() };
      doc.tasks[index] = task;
      return task;
    });
  }
  async write(operationId, kind, args, apply) {
    const signature = JSON.stringify({ kind, args });
    try {
      return await this.store.transact(doc => {
        const prior = doc.operations[operationId];
        if (prior) {
          if (prior.signature !== signature) throw new TaskHubError('OPERATION_ID_REUSED', 'Operation ID was used with different arguments');
          return { changed: false, result: prior.result };
        }
        const result = apply(doc);
        doc.storeRevision++;
        doc.operations[operationId] = { signature, result };
        return { changed: true, result };
      });
    } catch (error) {
      if (error.code !== 'OUTCOME_UNKNOWN') throw error;
      try {
        const prior = (await this.store.read()).operations[operationId];
        if (prior?.signature === signature) return prior.result;
      } catch { /* preserve uncertain outcome */ }
      throw error;
    }
  }
}
function findTask(doc, id, expectedRevision) {
  const index = doc.tasks.findIndex(task => task.id === id);
  if (index < 0) throw new TaskHubError('NOT_FOUND', 'Task not found');
  const current = doc.tasks[index];
  if (current.revision !== expectedRevision) throw new TaskHubError('CONFLICT', 'Task changed since it was read', { current });
  return index;
}
