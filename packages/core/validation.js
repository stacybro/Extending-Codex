export class TaskHubError extends Error {
  constructor(code, message, details = {}) { super(message); this.code = code; this.details = details; }
}
export function uuid(value, name) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
    throw new TaskHubError('INVALID_INPUT', name + ' must be a UUID');
  return value.toLowerCase();
}
export function revision(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TaskHubError('INVALID_INPUT', name + ' must be a positive integer');
  return value;
}
export function normalizeCreate(input) {
  only(input, ['title', 'notes', 'dueDate']);
  return { title: title(input.title), notes: notes(input.notes ?? ''), dueDate: dueDate(input.dueDate ?? null) };
}
export function normalizeUpdate(input) {
  only(input, ['title', 'notes', 'dueDate']);
  const out = {};
  if (Object.hasOwn(input, 'title')) out.title = title(input.title);
  if (Object.hasOwn(input, 'notes')) out.notes = notes(input.notes);
  if (Object.hasOwn(input, 'dueDate')) out.dueDate = dueDate(input.dueDate);
  if (!Object.keys(out).length) throw new TaskHubError('INVALID_INPUT', 'Provide at least one field to update');
  return out;
}
function only(value, names) {
  if (!value || typeof value !== 'object' || Object.keys(value).some(key => !names.includes(key)))
    throw new TaskHubError('INVALID_INPUT', 'Unsupported input field');
}
function title(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200)
    throw new TaskHubError('INVALID_INPUT', 'title must be 1 to 200 characters');
  return value.trim();
}
function notes(value) {
  if (typeof value !== 'string' || value.length > 10000)
    throw new TaskHubError('INVALID_INPUT', 'notes must be at most 10000 characters');
  return value;
}
function dueDate(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value + 'T00:00:00Z')) ||
      new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value)
    throw new TaskHubError('INVALID_INPUT', 'dueDate must be a real YYYY-MM-DD date or null');
  return value;
}
export function validateDocument(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.tasks))
    throw new TaskHubError('DATA_CORRUPT', 'Task data is invalid');
  if (data.version !== 1 && data.version !== 2)
    throw new TaskHubError('UNSUPPORTED_VERSION', 'Unsupported task data version');
  const ids = new Set();
  const tasks = data.tasks.map(task => {
    try {
      const id = uuid(task.id, 'id');
      if (id[14] !== '4') throw new Error('task ID must be UUID v4');
      if (ids.has(id)) throw new Error('duplicate ID');
      ids.add(id);
      const fields = normalizeCreate({ title: task.title, notes: task.notes, dueDate: task.dueDate });
      if (fields.title !== task.title || fields.notes !== task.notes ||
          (task.status !== 'open' && task.status !== 'completed')) throw new Error('invalid task');
      for (const stamp of [task.createdAt, task.updatedAt])
        if (typeof stamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(stamp) ||
            Number.isNaN(Date.parse(stamp))) throw new Error('invalid timestamp');
      if (data.version === 2) revision(task.revision, 'revision');
      return { ...task, revision: data.version === 1 ? 1 : task.revision };
    } catch { throw new TaskHubError('DATA_CORRUPT', 'Task data contains an invalid record'); }
  });
  if (data.version === 2 && (!Number.isSafeInteger(data.storeRevision) || data.storeRevision < 0 ||
      !data.operations || typeof data.operations !== 'object' || Array.isArray(data.operations)))
    throw new TaskHubError('DATA_CORRUPT', 'Task data metadata is invalid');
  if (data.version === 2) {
    for (const [key, entry] of Object.entries(data.operations)) {
      try {
        uuid(key, 'operationId');
        if (!entry || typeof entry.signature !== 'string' || !entry.result ||
            typeof entry.result !== 'object' || !ids.has(entry.result.id)) throw new Error('operation');
        normalizeCreate({ title: entry.result.title, notes: entry.result.notes, dueDate: entry.result.dueDate });
        revision(entry.result.revision, 'result revision');
        if (entry.result.status !== 'open' && entry.result.status !== 'completed') throw new Error('result status');
      } catch { throw new TaskHubError('DATA_CORRUPT', 'Task data contains an invalid operation record'); }
    }
  }
  return { version: 2, storeRevision: data.version === 1 ? 0 : data.storeRevision,
    tasks, operations: data.version === 1 ? {} : data.operations };
}
