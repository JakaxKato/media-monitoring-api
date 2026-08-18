import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist/src/db', { recursive: true });
await cp('src/db/migrations', 'dist/src/db/migrations', { recursive: true });
