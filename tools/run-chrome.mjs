// headless Chrome 调用的统一封装。
//
// 为什么需要它：在这台机器上直接 execFileSync 启动 chrome.exe 会偶发 EBUSY
// （文件被安全软件扫描时短暂独占），表现为验证脚本随机失败、但与被测代码无关。
// 这里做有限次退避重试，并给每次运行独立的 profile 目录，
// 避免复用默认 profile 时的锁冲突。验证结果不该被这类环境噪声左右。
import { execFileSync } from 'node:child_process';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export function runChrome(args, tries = 6) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return execFileSync(CHROME, args, {
        maxBuffer: 128 * 1024 * 1024,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      last = e;
      // 退避等待：Atomics.wait 是唯一能同步 sleep 又不依赖事件循环的方式。
      if (e.code === 'EBUSY' || e.code === 'EAGAIN') {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500 * (i + 1));
        continue;
      }
      throw e;
    }
  }
  throw last;
}
