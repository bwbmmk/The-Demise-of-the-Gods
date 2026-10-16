/**
 * 起一个独立进程的静态服务器，返回 { port, stop }。
 *
 * 必须独立进程：调用 Chrome 用 execFileSync 会阻塞本进程的事件循环，
 * 同进程内的 http 服务器将无法响应，Chrome 会一直等到超时。
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export function startStaticServer(root) {
  const child = spawn(process.execPath, [path.join(here, 'static-server.mjs'), root], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const port = new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('静态服务器启动超时')), 10000);
    child.stdout.on('data', (d) => {
      buf += String(d);
      const m = buf.match(/PORT (\d+)/);
      if (m) { clearTimeout(timer); resolve(Number(m[1])); }
    });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`静态服务器退出，code=${code}`)); });
  });

  return {
    port,
    stop() {
      try { child.kill('SIGTERM'); } catch { /* 已经退出 */ }
    },
  };
}
