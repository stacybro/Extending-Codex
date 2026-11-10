// Local Desktop OAuth and Google Picker setup for Drive mode. No task data is read here.
import { createServer } from 'node:http';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, rm, mkdir } from 'node:fs/promises';
import { join, resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const action = process.argv[2];
const account = process.env.TASKHUB_DRIVE_ACCOUNT;
if (!['auth', 'pick'].includes(action) || !['personal', 'work'].includes(account)) {
  console.error('Set TASKHUB_DRIVE_ACCOUNT=personal|work and run: node integrations/drive/authorize.js auth|pick');
  process.exit(2);
}
const profileDir = join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'TaskHub', 'drive-poc');
const credentialsFile = resolve(process.env.TASKHUB_DRIVE_CREDENTIALS_FILE ?? join(profileDir, 'oauth-client.json'));
const stateFile = resolve(process.env.TASKHUB_DRIVE_STATE_FILE ?? join(profileDir, 'poc-state.json'));
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
for (const path of [credentialsFile, stateFile]) {
  const inside = relative(repositoryRoot, path);
  if (inside !== '..' && !inside.startsWith('..' + sep) && !isAbsolute(inside))
    throw new Error('Drive OAuth files must be outside the repository.');
}
const fileId = process.env.TASKHUB_DRIVE_FILE_ID;
if (action === 'pick' && !fileId) throw new Error('TASKHUB_DRIVE_FILE_ID is required for Picker.');

const credentials = JSON.parse(await readFile(credentialsFile, 'utf8')).installed;
if (!credentials?.client_id || !credentials?.client_secret) throw new Error('Expected a Desktop OAuth client file.');
let state;
try { state = JSON.parse(await readFile(stateFile, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  state = { accounts: {} };
}
if (!state.accounts || typeof state.accounts !== 'object') throw new Error('OAuth state file is invalid.');

const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const nonce = randomBytes(24).toString('base64url');
let finish;
const callback = new Promise(resolveCallback => { finish = resolveCallback; });
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const picked = url.searchParams.get('picked_file_ids')?.split(',') ?? [];
  const code = url.searchParams.get('code');
  const valid = url.pathname === '/oauth2callback' && url.searchParams.get('state') === nonce &&
    Boolean(code) && (action !== 'pick' || picked.includes(fileId));
  response.writeHead(valid ? 200 : 400, { 'content-type': 'text/plain' }).end(valid
    ? 'TaskHub authorization received. Return to PowerShell.' : 'Authorization or file selection was not completed.');
  if (url.pathname === '/oauth2callback') finish(valid ? code : null);
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const redirect = `http://127.0.0.1:${server.address().port}/oauth2callback`;
const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
url.search = new URLSearchParams({ client_id: credentials.client_id, redirect_uri: redirect,
  response_type: 'code', scope: 'https://www.googleapis.com/auth/drive.file', access_type: 'offline',
  prompt: 'consent', code_challenge: challenge, code_challenge_method: 'S256', state: nonce }).toString();
if (action === 'pick') {
  url.searchParams.set('trigger_onepick', 'true');
  url.searchParams.set('file_ids', fileId);
}
console.log(`Open this URL with your ${account} Google account${action === 'pick' ? ' and select the configured TaskHub file' : ''}:\n${url}`);
const timer = setTimeout(() => { finish(null); server.close(); }, 600000);
const code = await callback;
clearTimeout(timer);
server.close();
if (!code) throw new Error('Authorization was cancelled or timed out.');

const response = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: credentials.client_id, client_secret: credentials.client_secret,
    code, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' }),
  signal: AbortSignal.timeout(15000)
});
const token = await response.json();
if (!response.ok || !token.access_token || !token.expires_in) throw new Error('OAuth token exchange failed.');
state.accounts[account] = { accessToken: token.access_token,
  refreshToken: token.refresh_token ?? state.accounts[account]?.refreshToken,
  expiresAt: Date.now() + token.expires_in * 1000 };
const temporary = stateFile + '.' + randomUUID() + '.tmp';
try {
  await mkdir(dirname(stateFile), { recursive: true });
  await writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600, flag: 'wx' });
  await rename(temporary, stateFile);
} catch (error) {
  await rm(temporary, { force: true });
  throw error;
}
console.log(`${account} ${action === 'pick' ? 'file selection' : 'authorization'} saved outside the repository.`);
