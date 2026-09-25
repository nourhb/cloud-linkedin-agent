#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/config.js';
import { PostRepository } from '../storage/postRepository.js';
import { TopicRepository } from '../storage/topicRepository.js';
import { RunRepository } from '../storage/runRepository.js';
import { buildDashboardSnapshot } from './dashboardData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function loadSnapshot() {
  const config = loadConfig();
  return buildDashboardSnapshot({
    posts: new PostRepository(config.paths.postsFile).getAll(),
    runs: new RunRepository(config.paths.runsFile).getAll(),
    topics: new TopicRepository(config.paths.topicsFile).getAll(),
    profileName: config.strategy.profile.name,
    timezone: config.schedule.timezone,
  });
}

function serveStatic(urlPath: string): { status: number; body: Buffer; contentType: string } | null {
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const resolved = path.normalize(path.join(PUBLIC_DIR, relative));
  if (!resolved.startsWith(PUBLIC_DIR) || !existsSync(resolved)) return null;
  const ext = path.extname(resolved);
  return {
    status: 200,
    body: readFileSync(resolved),
    contentType: MIME[ext] ?? 'application/octet-stream',
  };
}

async function main(): Promise<void> {
  const port = Number(process.env.UI_PORT) || 3030;

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && url.pathname === '/api/status') {
      try {
        const snapshot = loadSnapshot();
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify(snapshot));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      }
      return;
    }

    if (req.method !== 'GET') {
      res.writeHead(405).end('Method not allowed');
      return;
    }

    const file = serveStatic(url.pathname);
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(file.status, { 'Content-Type': file.contentType });
    res.end(file.body);
  });

  server.listen(port, '127.0.0.1', () => {
    console.log('\nCloudLinkedIn Agent monitor');
    console.log(`Open http://127.0.0.1:${port}\n`);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
