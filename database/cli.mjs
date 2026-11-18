import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDatabase } from '../src/config/database.js';

export function isMain(url) {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(url);
}

export async function runCommand(callback) {
  try {
    await callback();
  } catch (error) {
    console.error(error.code || 'DATABASE_ERROR', error.message);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}
