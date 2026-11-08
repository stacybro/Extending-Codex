import { copyFile, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { TaskHubError, validateDocument } from './validation.js';

export class JsonFileStore {
  constructor(path) { this.path = path; this.pending = Promise.resolve(); }

  async read() {
    try {
      return validateDocument(JSON.parse(await readFile(this.path, 'utf8')));
    } catch (error) {
      if (error.code === 'ENOENT') {
        try {
          await readFile(this.path + '.bak');
          throw new TaskHubError('RECOVERY_REQUIRED', 'Primary task data is missing; inspect the backup before recovery');
        } catch (backupError) {
          if (backupError.code !== 'ENOENT') throw backupError;
        }
        return { version: 2, storeRevision: 0, tasks: [], operations: {} };
      }
      if (error instanceof SyntaxError) throw new TaskHubError('DATA_CORRUPT', 'Task data is not valid JSON; inspect the backup before recovery');
      throw error;
    }
  }

  async transact(transform) {
    const run = this.pending.then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      const lockPath = this.path + '.lock';
      let lock;
      try { lock = await open(lockPath, 'wx', 0o600); }
      catch (error) {
        if (error.code === 'EEXIST') throw new TaskHubError('STORE_LOCKED', 'Task data is in use; retry later or inspect the stale lock');
        throw error;
      }
      try {
        const document = await this.read();
        const { changed, result } = transform(document);
        if (!changed) return result;
        const temporary = this.path + '.' + randomUUID() + '.tmp';
        try {
          const file = await open(temporary, 'wx', 0o600);
          try {
            await file.writeFile(JSON.stringify(document, null, 2) + '\n');
            await file.sync();
          } finally { await file.close(); }
          // Never back up invalid data or replace an unreadable primary.
          let hasPrimary = true;
          try { await readFile(this.path); } catch (error) {
            if (error.code === 'ENOENT') hasPrimary = false;
            else throw error;
          }
          if (hasPrimary) {
            const backupTemp = this.path + '.' + randomUUID() + '.backup.tmp';
            try {
              await copyFile(this.path, backupTemp);
              await replaceWithRetry(backupTemp, this.path + '.bak');
            } finally { await rm(backupTemp, { force: true }); }
          }
          try { await replaceWithRetry(temporary, this.path); }
          catch { throw new TaskHubError('OUTCOME_UNKNOWN', 'Could not confirm whether task data was saved; retry with the same operation ID'); }
          return result;
        } finally { await rm(temporary, { force: true }); }
      } finally {
        await lock.close();
        await rm(lockPath, { force: true });
      }
    });
    this.pending = run.catch(() => {});
    return run;
  }

  async readBackup() {
    try { return validateDocument(JSON.parse(await readFile(this.path + '.bak', 'utf8'))); }
    catch (error) {
      if (error.code === 'ENOENT') throw new TaskHubError('BACKUP_NOT_FOUND', 'No task data backup exists');
      if (error instanceof SyntaxError) throw new TaskHubError('DATA_CORRUPT', 'Task data backup is not valid JSON');
      throw error;
    }
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
