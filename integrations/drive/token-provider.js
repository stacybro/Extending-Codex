import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { TaskHubError } from '../../packages/core/validation.js';

// Reads the isolated Phase A Desktop OAuth state. Each account has its own token.
export class DriveTokenProvider {
  constructor({ credentialsFile, stateFile, account, fetchImpl = fetch, timeoutMs = 15000 }) {
    this.credentialsFile = credentialsFile;
    this.stateFile = stateFile;
    this.account = account;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async token() {
    let credentials, state;
    try {
      credentials = JSON.parse(await readFile(this.credentialsFile, 'utf8')).installed;
      state = JSON.parse(await readFile(this.stateFile, 'utf8'));
    } catch {
      throw new TaskHubError('UNAUTHORIZED', 'Drive OAuth configuration is missing or unreadable');
    }
    if (!credentials?.client_id || !credentials?.client_secret || !state?.accounts?.[this.account])
      throw new TaskHubError('UNAUTHORIZED', 'Authorize this Google account before using Drive storage');
    const record = state.accounts[this.account];
    if (record.accessToken && Date.now() < record.expiresAt - 60000) return record.accessToken;
    if (!record.refreshToken) throw new TaskHubError('UNAUTHORIZED', 'Drive authorization expired; authorize again');
    let response;
    try {
      response = await this.fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: credentials.client_id, client_secret: credentials.client_secret,
          refresh_token: record.refreshToken, grant_type: 'refresh_token' }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch {
      throw new TaskHubError('DRIVE_UNAVAILABLE', 'Could not refresh Drive authorization; check network access');
    }
    let body;
    try { body = await response.json(); } catch { body = {}; }
    if (!response.ok || !body.access_token || !Number.isFinite(body.expires_in))
      throw new TaskHubError('UNAUTHORIZED', 'Drive authorization expired or was revoked; authorize again');
    record.accessToken = body.access_token;
    record.expiresAt = Date.now() + body.expires_in * 1000;
    if (body.refresh_token) record.refreshToken = body.refresh_token;
    const temporary = this.stateFile + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600, flag: 'wx' });
      await rename(temporary, this.stateFile);
    } catch {
      await rm(temporary, { force: true });
      throw new TaskHubError('UNAUTHORIZED', 'Could not save refreshed Drive authorization');
    }
    return record.accessToken;
  }
}
