import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DriveTokenProvider } from '../integrations/drive/token-provider.js';

async function fixture(t, fetchImpl) {
  const root = join(process.cwd(), '.taskhub', 'test');
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(join(root, 'oauth-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const credentialsFile = join(dir, 'client.json');
  const stateFile = join(dir, 'state.json');
  await writeFile(credentialsFile, JSON.stringify({ installed: { client_id: 'test-id', client_secret: 'test-secret' } }));
  await writeFile(stateFile, JSON.stringify({ accounts: { work: {
    accessToken: 'old', refreshToken: 'refresh', expiresAt: 0 } } }));
  return { dir, stateFile, provider: new DriveTokenProvider({ credentialsFile, stateFile,
    account: 'work', fetchImpl }) };
}

test('Drive token provider refreshes an expired token and preserves the refresh token', async t => {
  const { stateFile, provider } = await fixture(t, async (url, options) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    assert.equal(new URLSearchParams(options.body).get('grant_type'), 'refresh_token');
    return new Response(JSON.stringify({ access_token: 'new', expires_in: 3600 }));
  });
  assert.equal(await provider.token(), 'new');
  const saved = JSON.parse(await readFile(stateFile, 'utf8'));
  assert.equal(saved.accounts.work.accessToken, 'new');
  assert.equal(saved.accounts.work.refreshToken, 'refresh');
});

test('Drive token provider distinguishes expired authorization from network failure', async t => {
  const { provider } = await fixture(t, async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
  await assert.rejects(provider.token(), { code: 'UNAUTHORIZED' });
  provider.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(provider.token(), { code: 'DRIVE_UNAVAILABLE' });
  provider.account = 'unknown';
  await assert.rejects(provider.token(), { code: 'UNAUTHORIZED' });
});
