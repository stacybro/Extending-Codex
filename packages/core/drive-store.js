import { mkdir, open, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { TaskHubError, validateDocument } from './validation.js';

export class DriveStore {
  constructor({ fileId, tokenProvider, backupDir, fetchImpl = fetch, timeoutMs = 15000 }) {
    if (!fileId || !tokenProvider || !backupDir) throw new TaskHubError('INVALID_CONFIG', 'Drive file ID, authorization, and backup directory are required');
    this.fileId = fileId;
    this.tokenProvider = tokenProvider;
    this.backupDir = backupDir;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.pending = Promise.resolve();
  }

  async request(path, { method = 'GET', body, contentType, writing = false } = {}) {
    const token = await this.tokenProvider.token();
    let response;
    try {
      response = await this.fetch(`https://www.googleapis.com/${path}`, {
        method, body,
        headers: { authorization: `Bearer ${token}`, ...(contentType ? { 'content-type': contentType } : {}) },
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch {
      throw new TaskHubError(writing ? 'OUTCOME_UNKNOWN' : 'DRIVE_UNAVAILABLE',
        writing ? 'Drive write outcome is unknown; retry only with the same operation ID' : 'Cannot read Drive; check network access');
    }
    if (!response.ok) {
      if (response.status === 401) throw new TaskHubError('UNAUTHORIZED', 'Drive authorization expired; authorize again');
      if (response.status === 403) throw new TaskHubError('FORBIDDEN', 'Google account lacks access to this Drive file or app');
      if (response.status === 404) throw new TaskHubError('DRIVE_FILE_UNAVAILABLE', 'Drive file was not found or has not been selected for this app');
      throw new TaskHubError(writing ? 'OUTCOME_UNKNOWN' : 'DRIVE_UNAVAILABLE',
        writing ? `Drive write returned HTTP ${response.status}; outcome is unknown` : `Drive read returned HTTP ${response.status}`);
    }
    try { return await response.text(); }
    catch {
      throw new TaskHubError(writing ? 'OUTCOME_UNKNOWN' : 'DRIVE_UNAVAILABLE',
        writing ? 'Drive write outcome is unknown; retry only with the same operation ID' : 'Drive response could not be read');
    }
  }

  async metadata() {
    let data;
    try { data = JSON.parse(await this.request(`drive/v3/files/${encodeURIComponent(this.fileId)}?fields=id,version,mimeType,trashed`)); }
    catch (error) {
      if (error instanceof SyntaxError) throw new TaskHubError('DRIVE_UNAVAILABLE', 'Drive metadata is invalid');
      throw error;
    }
    if (data.id !== this.fileId || !/^\d+$/.test(data.version) || data.trashed || data.mimeType !== 'application/json')
      throw new TaskHubError('DRIVE_FILE_INVALID', 'Drive file metadata is invalid or file is trashed');
    return data;
  }

  async readVersioned() {
    const metadata = await this.metadata();
    const raw = await this.request(`drive/v3/files/${encodeURIComponent(this.fileId)}?alt=media`);
    let document;
    try { document = validateDocument(JSON.parse(raw)); }
    catch (error) {
      if (error instanceof SyntaxError) throw new TaskHubError('DATA_CORRUPT', 'Drive task data is not valid JSON');
      throw error;
    }
    return { document, version: metadata.version };
  }

  async read() { return (await this.readVersioned()).document; }

  async backup(document, version) {
    const safeId = this.fileId.replace(/[^A-Za-z0-9_-]/g, '_');
    const name = `${safeId}-${new Date().toISOString().replace(/[:.]/g, '-')}-${version}-${randomUUID()}.json`;
    const path = join(this.backupDir, name);
    try {
      await mkdir(this.backupDir, { recursive: true });
      const handle = await open(path, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(document, null, 2) + '\n'); await handle.sync(); }
      finally { await handle.close(); }
    } catch {
      try { await rm(path, { force: true }); } catch {}
      throw new TaskHubError('BACKUP_FAILED', 'Could not save a validated local backup; Drive was not written');
    }
    return path;
  }

  async transact(transform) {
    const run = this.pending.then(async () => {
      const { document, version } = await this.readVersioned();
      const previous = structuredClone(document);
      const { changed, result } = transform(document);
      if (!changed) return result;
      validateDocument(document);
      await this.backup(previous, version);
      const current = await this.metadata();
      if (current.version !== version) throw new TaskHubError('DRIVE_CHANGED', 'Drive file changed before upload; reload tasks',
        { expectedVersion: version, currentVersion: current.version });
      await this.request(`upload/drive/v3/files/${encodeURIComponent(this.fileId)}?uploadType=media`, {
        method: 'PATCH', body: JSON.stringify(document), contentType: 'application/json', writing: true
      });
      return result;
    });
    this.pending = run.catch(() => {});
    return run;
  }
}
