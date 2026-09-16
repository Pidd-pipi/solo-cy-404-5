import { defineConfig } from '@playwright/test';

// 启动前自检：浏览器缺失则自动安装、系统库缺失则在用户目录自动补齐并注入库路径，
// 无法补齐时打印可直接执行的命令。清空本机缓存后也能自动继续，而不是停在浏览器启动错误。
const { ensureBrowser } = await import('./scripts/ensure-browser.mjs');
ensureBrowser();

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
