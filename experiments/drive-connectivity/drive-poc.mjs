// Isolated Phase A connectivity probe. Never points at TaskHub's task store.
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const root = process.env.TASKHUB_DRIVE_POC_HOME ??
  join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'TaskHub', 'drive-poc');
const credentialPath = join(root, 'oauth-client.json');
const statePath = join(root, 'poc-state.json');
const scope = 'https://www.googleapis.com/auth/drive.file';
const [command, account] = process.argv.slice(2);

if (!['auth', 'pick', 'create', 'create-store', 'read', 'update', 'status'].includes(command) || !['personal', 'work'].includes(account)) {
  console.error('Usage: node experiments/drive-connectivity/drive-poc.mjs <auth|pick|create|create-store|read|update|status> <personal|work>');
  process.exit(2);
}

const credentials = JSON.parse(await readFile(credentialPath, 'utf8')).installed;
if (!credentials?.client_id || !credentials?.client_secret) throw new Error('Invalid Desktop OAuth client file.');
let state;
try { state = JSON.parse(await readFile(statePath, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  state = { accounts: {}, fileId: null };
}

async function saveState() {
  await mkdir(root, { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
}

async function getToken() {
  const record = state.accounts[account];
  if (!record) throw new Error(`Authorize ${account} first.`);
  if (record.accessToken && Date.now() < record.expiresAt - 60_000) return record.accessToken;
  if (!record.refreshToken) throw new Error(`No refresh token for ${account}; authorize again.`);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: credentials.client_id, client_secret: credentials.client_secret,
      refresh_token: record.refreshToken, grant_type: 'refresh_token' }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Token refresh failed: ${result.error ?? response.status}`);
  record.accessToken = result.access_token;
  record.expiresAt = Date.now() + result.expires_in * 1000;
  await saveState();
  return record.accessToken;
}

async function drive(path, options = {}) {
  const prefix = path.includes('uploadType=') ? 'upload/drive/v3' : 'drive/v3';
  const response = await fetch(`https://www.googleapis.com/${prefix}/${path}`, {
    ...options,
    headers: { authorization: `Bearer ${await getToken()}`, ...options.headers },
  });
  const body = await response.text();
  if (!response.ok) {
    let message = body;
    try { message = JSON.parse(body).error?.message ?? body; } catch {}
    throw new Error(`Drive HTTP ${response.status}: ${message}`);
  }
  if (!body) return null;
  try { return JSON.parse(body); } catch { return body; }
}

if (command === 'auth' || command === 'pick') {
  const selectedFileId = process.env.TASKHUB_DRIVE_FILE_ID ?? state.fileId;
  if (command === 'pick' && !selectedFileId) throw new Error('Select a disposable file first.');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const nonce = randomBytes(24).toString('base64url');
  let resolveCode;
  const codePromise = new Promise((resolve) => { resolveCode = resolve; });
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname !== '/oauth2callback' || url.searchParams.get('state') !== nonce) {
      response.writeHead(400).end('Invalid OAuth callback.');
      return;
    }
    const code = url.searchParams.get('code');
    const pickedIds = url.searchParams.get('picked_file_ids')?.split(',') ?? [];
    const accepted = Boolean(code) && (command !== 'pick' || pickedIds.includes(selectedFileId));
    response.writeHead(accepted ? 200 : 400, { 'content-type': 'text/plain' })
      .end(accepted ? 'Authorization received. Return to PowerShell.' : 'Authorization or file selection was not completed.');
    resolveCode(accepted ? code : null);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const redirect = `http://127.0.0.1:${server.address().port}/oauth2callback`;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: credentials.client_id, redirect_uri: redirect,
    response_type: 'code', scope, access_type: 'offline', prompt: 'consent',
    code_challenge: challenge, code_challenge_method: 'S256', state: nonce }).toString();
  if (command === 'pick') {
    url.searchParams.set('trigger_onepick', 'true');
    url.searchParams.set('file_ids', selectedFileId);
  }
  console.log(command === 'pick'
    ? `Open this URL with your ${account} account and select the disposable TaskHub JSON file:\n${url}`
    : `Open this URL and choose your ${account} account:\n${url}`);
  const timeout = setTimeout(() => { resolveCode(null); server.close(); }, 600_000);
  const code = await codePromise;
  clearTimeout(timeout);
  server.close();
  if (!code) throw new Error('Authorization cancelled or timed out.');
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: credentials.client_id, client_secret: credentials.client_secret,
      code, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' }),
  });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok) throw new Error(`Token exchange failed: ${token.error ?? tokenResponse.status}`);
  state.accounts[account] = { accessToken: token.access_token,
    refreshToken: token.refresh_token ?? state.accounts[account]?.refreshToken,
    expiresAt: Date.now() + token.expires_in * 1000 };
  await saveState();
  console.log(command === 'pick'
    ? `${account} selected the disposable file; authorization saved outside the repository.`
    : `${account} authorization saved outside the repository.`);
} else if (command === 'status') {
  console.log(JSON.stringify({ authorized: Boolean(state.accounts[account]), fileSelected: Boolean(state.fileId) }));
} else if (command === 'create' || command === 'create-store') {
  if (account !== 'personal') throw new Error('Create the disposable file with the personal account.');
  const key = command === 'create' ? 'fileId' : 'storeFileId';
  if (state[key]) throw new Error('A disposable file is already recorded for this command; refusing to create another.');
  const content = JSON.stringify(command === 'create' ? { proofOfConcept: 'TaskHub Drive Phase A', counter: 0 } :
    { version: 2, storeRevision: 0, tasks: [], operations: {} });
  const name = command === 'create' ? 'taskhub-drive-poc.json' : 'taskhub-drive-integration-test.json';
  const boundary = `taskhub-${randomBytes(12).toString('hex')}`;
  const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType: 'application/json' })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
  const result = await drive('files?uploadType=multipart&fields=id,name,version', {
    method: 'POST', headers: { 'content-type': `multipart/related; boundary=${boundary}` }, body: multipart,
  });
  state[key] = result.id;
  await saveState();
  console.log(JSON.stringify({ created: true, fileId: result.id, name: result.name, version: result.version }));
} else {
  if (!state.fileId) throw new Error('Create the disposable file first.');
  const id = encodeURIComponent(state.fileId);
  if (command === 'read') {
    const metadata = await drive(`files/${id}?fields=id,name,version,mimeType`);
    const content = await drive(`files/${id}?alt=media`);
    console.log(JSON.stringify({ metadata, content }));
  } else if (command === 'update') {
    const current = await drive(`files/${id}?alt=media`);
    if (current.proofOfConcept !== 'TaskHub Drive Phase A' || !Number.isSafeInteger(current.counter))
      throw new Error('Unexpected disposable file contents; refusing to update.');
    const content = JSON.stringify({ ...current, counter: current.counter + 1 });
    const result = await drive(`files/${id}?uploadType=media&fields=id,name,version`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: content,
    });
    console.log(JSON.stringify({ updated: true, version: result.version, counter: current.counter + 1 }));
  }
}
