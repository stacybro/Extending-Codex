import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateDocument } from '../../packages/core/validation.js';

if (process.argv.length !== 3) {
  console.error('Usage: node integrations/drive/validate-backup.js <absolute-backup-path>');
  process.exit(2);
}
try {
  const data = validateDocument(JSON.parse(await readFile(resolve(process.argv[2]), 'utf8')));
  console.log(`Valid TaskHub version 2 data: ${data.tasks.length} tasks, store revision ${data.storeRevision}.`);
} catch (error) {
  console.error(`Backup validation failed: ${error.code ?? 'INVALID_JSON'}`);
  process.exit(1);
}
