import { build } from 'esbuild';

build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/server.cjs',
  format: 'cjs',
  external: ['express', 'cors', 'dotenv', 'socket.io', '@prisma/client', 'vite'],
}).catch(() => process.exit(1));
