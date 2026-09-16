// Playwright 浏览器启动前自检与自动补齐。
//
// 解决的问题：在没有 root 权限的干净机器上，`npx playwright install chromium`
// 只下载浏览器二进制，不安装系统共享库；清空本机缓存后直接运行 e2e 会在浏览器
// 启动阶段报原始错误（如 libnspr4.so: cannot open shared object file）。
//
// 行为：
//   1. 浏览器缺失 → 自动执行 `npx playwright install chromium`（仅需用户目录写权限）；
//      失败则给出可直接复制的安装命令并退出。
//   2. 用 ldd 检测浏览器二进制缺失的共享库；已齐全 → 直接继续。
//   3. Debian/Ubuntu 且无 root 时，自动 `apt-get download` 对应运行库到用户缓存目录
//      （不写系统目录），解压后把库目录注入 LD_LIBRARY_PATH（对后续 playwright 进程生效）。
//   4. 无法自动补齐（非 apt 系统 / 无 apt-get / 下载失败且仍缺库）→ 打印按环境区分的
//      可直接执行命令，而不是停在浏览器启动错误。

import { existsSync, mkdirSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const PW_LIBS_ROOT = join(homedir(), '.cache', 'pw-libs', 'root');
const LIB_DIRS = [
  join(PW_LIBS_ROOT, 'usr', 'lib'),
  join(PW_LIBS_ROOT, 'usr', 'lib', 'aarch64-linux-gnu'),
  join(PW_LIBS_ROOT, 'usr', 'lib', 'x86_64-linux-gnu'),
  join(PW_LIBS_ROOT, 'lib'),
  join(PW_LIBS_ROOT, 'lib', 'aarch64-linux-gnu'),
  join(PW_LIBS_ROOT, 'lib', 'x86_64-linux-gnu'),
];

function log(message) {
  console.log(`[ensure-browser] ${message}`);
}
function fail(lines) {
  console.error('\n[ensure-browser] 无法启动 Playwright Chromium：');
  for (const line of lines) console.error(`  ${line}`);
  console.error('');
  process.exit(1);
}

function has(bin) {
  return spawnSync('sh', ['-c', `command -v ${bin}`]).status === 0;
}

function chromiumExecutable() {
  // 不静态 import @playwright/test，避免被 vitest/构建链路误触；用 createRequire 取路径
  const requireFromHere = createRequire(join(process.cwd(), 'package.json'));
  const { chromium } = requireFromHere('@playwright/test');
  return chromium.executablePath();
}

/** Playwright 无头模式默认启动的 headless-shell 路径（与完整 chrome 同版本目录） */
function headlessShellExecutable(chromePath) {
  const candidate = chromePath
    .replace('/chromium-', '/chromium_headless_shell-')
    .replace(/\/chrome-linux[^/]*\/chrome$/, (dir) => `${dir}/chrome-headless-shell`);
  return existsSync(candidate) ? candidate : null;
}

function installBrowser() {
  log('未检测到 Chromium，开始执行：npx playwright install chromium …');
  const result = spawnSync('npx', ['playwright', 'install', 'chromium'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    fail([
      '浏览器自动安装失败。请在 frontend 目录手动执行：',
      '  npx playwright install chromium',
      '若还缺少系统依赖（有 root 权限时）可执行：',
      '  npx playwright install-deps chromium',
    ]);
  }
}

/** 用 ldd 收集二进制缺失的共享库文件名（去重） */
function missingLibraries(binaries) {
  const missing = new Set();
  for (const binary of binaries) {
    const result = spawnSync('ldd', [binary], { encoding: 'utf-8' });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    for (const match of output.matchAll(/^\s*([A-Za-z0-9_.+\-]+\.so[\d.]*)\s+=>\s*not found/gm)) {
      missing.add(match[1]);
    }
  }
  return [...missing];
}

// 缺失库文件名 → Debian/Ubuntu 运行包名
const LIB_TO_PACKAGES = {
  'libnspr4.so': ['libnspr4'],
  'libnss3.so': ['libnss3'],
  'libnssutil3.so': ['libnss3'],
  'libsmime3.so': ['libnss3'],
  'libXcomposite.so.1': ['libxcomposite1'],
  'libXdamage.so.1': ['libxdamage1'],
  'libXfixes.so.3': ['libxfixes3'],
  'libXrandr.so.2': ['libxrandr2'],
  'libXi.so.6': ['libxi6'],
  'libasound.so.2': ['libasound2'],
  'libatk-1.0.so.0': ['libatk1.0-0', 'libatk1.0-0t64'],
  'libatk-bridge-2.0.so.0': ['libatk-bridge2.0-0', 'libatk-bridge2.0-0t64'],
  'libatspi.so.0': ['libatspi2.0-0', 'libatspi2.0-0t64'],
  'libcups.so.2': ['libcups2', 'libcups2t64'],
  'libdbus-1.so.3': ['libdbus-1-3'],
  'libgbm.so.1': ['libgbm1'],
  'libxkbcommon.so.0': ['libxkbcommon0'],
  'libdrm.so.2': ['libdrm2'],
  'libavahi-client.so.3': ['libavahi-client3'],
  'libavahi-common.so.3': ['libavahi-common3'],
  'libwayland-server.so.0': ['libwayland-server0'],
  'libpango-1.0.so.0': ['libpango-1.0-0'],
  'libcairo.so.2': ['libcairo2'],
  'libexpat.so.1': ['libexpat1'],
};

const ALL_DEB_PACKAGES = [
  'libnspr4', 'libnss3', 'libxcomposite1', 'libxdamage1', 'libxfixes3', 'libxrandr2',
  'libxi6', 'libasound2', 'libatk1.0-0', 'libatk-bridge2.0-0', 'libatspi2.0-0',
  'libcups2', 'libdbus-1-3', 'libgbm1', 'libxkbcommon0', 'libdrm2',
  'libavahi-client3', 'libavahi-common3', 'libwayland-server0', 'libpango-1.0-0',
  'libcairo2', 'libexpat1',
];

function isDebianLike() {
  return existsSync('/etc/debian_version') && (has('apt-get') || has('apt'));
}

/** 无 root 时用 apt-get download 把运行库解压到用户目录；返回是否仍有缺失库 */
function provisionWithApt(missing) {
  const wanted = new Set();
  for (const lib of missing) (LIB_TO_PACKAGES[lib] || []).forEach((pkg) => wanted.add(pkg));
  // 一并安装常用基础包，覆盖个别版本下额外的传递依赖
  for (const pkg of ALL_DEB_PACKAGES) wanted.add(pkg);
  const packages = [...wanted];

  const debsDir = join(homedir(), '.cache', 'pw-libs', 'debs');
  const listsDir = '/tmp/pw-apt-lists';
  mkdirSync(debsDir, { recursive: true });
  mkdirSync(join(listsDir, 'partial'), { recursive: true });

  const aptGet = process.env.APT_GET_BIN || 'apt-get';
  log(`检测到 ${missing.length} 个缺失库，使用 apt-get download 在用户目录补齐（无需 root）…`);

  const update = spawnSync(
    aptGet,
    ['-o', `Dir::State::Lists=${listsDir}`, 'update'],
    { encoding: 'utf-8' },
  );
  if (update.status !== 0) {
    log(`apt-get update 失败（可能无网络/无索引），继续尝试直接下载。\n${update.stderr || ''}`.trim());
  }

  // 逐包下载并忽略本机不存在的候选名（如 Debian 的 libatk1.0-0 vs Ubuntu 24.04 的 …t64），
  // 任一名称不存在不应导致整批失败。
  let downloaded = 0;
  for (const pkg of packages) {
    const result = spawnSync(
      aptGet,
      ['-o', `Dir::State::Lists=${listsDir}`, 'download', pkg],
      { cwd: debsDir, encoding: 'utf-8' },
    );
    if (result.status === 0) downloaded += 1;
  }
  if (downloaded === 0) {
    console.error('[ensure-browser] 所有运行库包均下载失败，无法自动补齐。');
    return false;
  }

  const debs = spawnSync('sh', ['-c', 'ls *.deb'], { cwd: debsDir, encoding: 'utf-8' }).stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (debs.length === 0) return false;

  mkdirSync(PW_LIBS_ROOT, { recursive: true });
  for (const deb of debs) {
    const result = spawnSync('dpkg-deb', ['-x', join(debsDir, deb), PW_LIBS_ROOT], {
      encoding: 'utf-8',
    });
    if (result.status !== 0) return false;
  }
  return true;
}

function existingLibDirs() {
  return LIB_DIRS.filter((dir) => existsSync(dir));
}

function applyLibraryPath() {
  const dirs = existingLibDirs();
  if (dirs.length === 0) return;
  const previous = process.env.LD_LIBRARY_PATH || '';
  process.env.LD_LIBRARY_PATH = [...dirs, previous].filter(Boolean).join(':');
}

export function ensureBrowser() {
  if (platform() !== 'linux') return; // CI 以 Linux 为主；其他平台直接交给 Playwright 默认行为

  let executable;
  try {
    executable = chromiumExecutable();
  } catch (error) {
    fail([
      '无法加载 @playwright/test，请先在 frontend 目录安装依赖：',
      '  npm install',
      String(error && error.message ? error.message : error),
    ]);
  }

  if (!existsSync(executable)) {
    installBrowser();
    executable = chromiumExecutable();
    if (!existsSync(executable)) {
      fail(['浏览器安装后仍未找到可执行文件，请手动执行：', '  npx playwright install chromium']);
    }
  }

  const headlessShell = headlessShellExecutable(executable);
  const binaries = [executable, headlessShell].filter(Boolean);

  // 若之前已在用户缓存补过库，先注入路径再检测，避免每次运行都重复下载
  applyLibraryPath();

  let missing = missingLibraries(binaries);
  if (missing.length === 0) {
    return;
  }

  log(`缺少共享库：${missing.join(', ')}`);
  if (!isDebianLike() || !has('dpkg-deb')) {
    fail([
      '当前系统无法自动补齐系统库。可按环境选择：',
      '有 root 权限：',
      '  npx playwright install-deps chromium',
      'Debian/Ubuntu（无 root）：',
      '  mkdir -p /tmp/pw-libs && cd /tmp/pw-libs',
      '  apt-get download libnspr4 libnss3 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxi6 libasound2 libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libcups2 libdbus-1-3 libgbm1 libxkbcommon0 libdrm2 libavahi-client3 libavahi-common3 libwayland-server0',
      '  for f in *.deb; do dpkg-deb -x "$f" $HOME/.cache/pw-libs/root; done',
    ]);
  }

  const provisioned = provisionWithApt(missing);
  applyLibraryPath();

  // 重新检测（带上新注入的 LD_LIBRARY_PATH）
  missing = missingLibraries(binaries);
  if (missing.length > 0) {
    fail([
      provisioned ? '已下载部分运行库，但仍缺少：' : '自动补齐失败，仍缺少：',
      `  ${missing.join(', ')}`,
      '有 root 权限时可直接执行：',
      '  npx playwright install-deps chromium',
    ]);
  }
  log('系统库已就绪，继续运行 E2E。');
}

// 直接以 node 运行本文件时也可手动预检
const invokedDirectly = process.argv[1] && process.argv[1].endsWith('ensure-browser.mjs');
if (invokedDirectly) {
  ensureBrowser();
  log('OK');
}
