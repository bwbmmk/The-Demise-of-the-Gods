/**
 * 极简静态服务器（独立进程）。
 *
 * 为什么要单独一个进程：
 * 调用 Chrome 用的是 execFileSync —— 它会**阻塞 Node 的事件循环**。
 * 如果服务器和 Chrome 驱动跑在同一个进程里，服务器就永远没机会响应请求，
 * Chrome 会一直等页面，直到超时。把它拆出去，主进程再怎么阻塞都不影响它。
 *
 * 启动后往 stdout 打一行 `PORT <n>`，父进程据此拿到端口。
 *
 * 用法：node static-server.mjs <root>
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || process.cwd());

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.join(root, rel);
    // 防目录穿越：规范化后必须仍在 root 之内
    const resolved = path.resolve(file);
    if (!resolved.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
    const body = await readFile(resolved);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(resolved).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

server.listen(0, '127.0.0.1', () => {
  process.stdout.write(`PORT ${server.address().port}\n`);
});

// 父进程被杀时一起退，不留孤儿进程
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
