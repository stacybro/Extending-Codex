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
