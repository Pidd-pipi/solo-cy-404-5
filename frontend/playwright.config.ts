import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// 无 root 环境下 Chromium 系统库缺失时，允许使用用户目录内解压的本地库（存在才注入）
const localLibDirs = [
  join(homedir(), '.cache/pw-libs/root/usr/lib/aarch64-linux-gnu'),
  join(homedir(), '.cache/pw-libs/root/lib/aarch64-linux-gnu'),
].filter(existsSync);
if (localLibDirs.length > 0) {
  process.env.LD_LIBRARY_PATH = [...localLibDirs, process.env.LD_LIBRARY_PATH ?? '']
    .filter(Boolean)
    .join(':');
}

// E2E：真实 Vite 开发服务器 + 真实 Chromium，覆盖模块重置无法模拟的「关闭页面重开」与真实文件导入导出
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:28310',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:28310/resumes',
    timeout: 60_000,
    reuseExistingServer: false,
  },
});
