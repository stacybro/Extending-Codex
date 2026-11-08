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
