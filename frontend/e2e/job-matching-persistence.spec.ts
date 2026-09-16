import { Browser, BrowserContext, Page, expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  deleteFirstWorkExperience,
  renameFirstWorkCompany,
  seedJobFlow,
} from './helpers';

// 每个用例自建独立 BrowserContext：localStorage 天然隔离，互不污染。
async function freshContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext();
  context.setDefaultTimeout(15_000);
  return context;
}

/**
 * 真实走页面「导入」：选择文件后，应用会异步读取→写入→location.reload()。
 * 必须等到这次由导入触发的文档重载真正完成，否则后续导航会与 reload 撞车
 * （干净上下文导入前也带种子简历，单看简历数量无法判断导入是否已落盘）。
 */
async function importBackupFile(page: Page, file: string): Promise<void> {
  const reloaded = page.waitForEvent('framenavigated');
  await page.getByTestId('import-file-input').setInputFiles(file);
  await reloaded;
  await page.waitForLoadState('load');
}

test.describe('岗位匹配中心：真实浏览器持久化 E2E', () => {
  test('场景：写入岗位/要求/绑定/检查后，刷新、关闭页面重开、整浏览器重启，覆盖率与失联状态仍可回读', async ({
    browser,
  }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();

    const { jobPath, resumeId } = await seedJobFlow(page, {
      title: 'E2E 产品经理岗位',
      company: 'E2E 公司',
      requirements: ['第一条岗位要求：要有 B 端经验', '第二条岗位要求：懂增长'],
    });

    // 初始覆盖度：2 条要求中第 1 条已绑定 → 1/2 = 50%，检查 1/5
    await expect(page.getByTestId('coverage-summary')).toContainText('1 / 2');
    await expect(page.getByTestId('coverage-percent')).toHaveText('50%');
    await expect(page.getByTestId('checklist-progress')).toHaveText('1/5');
    await expect(page.getByTestId('requirement-text').first()).toContainText('第一条岗位要求');
    await expect(page.getByTestId('binding-chip')).toHaveCount(1);

    // 证据条目改名：芯片实时显示新名字（id 追踪）
    await renameFirstWorkCompany(page, resumeId, 'E2E改名后的公司');
    await page.goto(jobPath);
    await expect(page.getByTestId('binding-chip')).toContainText('E2E改名后的公司');

    // 删除被绑定的工作条目：芯片转为失联，显示绑定时快照名与「条目已删除」
    await deleteFirstWorkExperience(page, resumeId);
    await page.goto(jobPath);
    const orphanChip = page.getByTestId('binding-chip');
    await expect(orphanChip).toHaveAttribute('data-orphan', 'true');
    await expect(orphanChip).toContainText('条目已删除');
    await expect(orphanChip).toContainText('青松科技');
    // 覆盖度变为 0/2，且出现 1 条失联计数
    await expect(page.getByTestId('coverage-summary')).toContainText('0 / 2');
    await expect(page.getByTestId('coverage-orphan-count')).toContainText('1 条失联');

    const expected = {
      requirementCount: 2,
      chipCount: 1,
      checklist: '1/5',
      orphan: 'true',
    };

    // ① 刷新页面（同一标签页 reload）
    await page.reload();
    await expect(page.getByTestId('requirement-item')).toHaveCount(expected.requirementCount);
    await expect(page.getByTestId('binding-chip')).toHaveCount(expected.chipCount);
    await expect(page.getByTestId('checklist-progress')).toHaveText(expected.checklist);
    await expect(page.getByTestId('binding-chip')).toHaveAttribute('data-orphan', expected.orphan);

    // ② 关闭页面后在同一上下文重新打开（模拟关闭标签页/窗口再开，磁盘 localStorage 仍在）
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(jobPath);
    await expect(reopened.getByTestId('requirement-item')).toHaveCount(expected.requirementCount);
    await expect(reopened.getByTestId('binding-chip')).toHaveCount(expected.chipCount);
    await expect(reopened.getByTestId('coverage-summary')).toContainText('0 / 2');
    await expect(reopened.getByTestId('binding-chip')).toHaveAttribute('data-orphan', expected.orphan);
    await expect(reopened.getByTestId('checklist-progress')).toHaveText(expected.checklist);
    // 输入结果仍可回读：岗位名、公司名、要求正文
    await expect(reopened.locator('input[aria-label="岗位名称"]')).toHaveValue('E2E 产品经理岗位');
    await expect(reopened.locator('input[aria-label="公司名称"]')).toHaveValue('E2E 公司');
    await expect(reopened.getByTestId('requirement-text').first()).toContainText('第一条岗位要求');

    // ③ 模拟整浏览器重启：把存储态落盘后销毁上下文，再用该存储态开全新上下文
    const stateFile = test.info().outputPath('storage-state-after-close.json');
    await context.storageState({ path: stateFile });
    await context.close();

    const restarted = await browser.newContext({ storageState: stateFile });
    const restartedPage = await restarted.newPage();
    await restartedPage.goto(jobPath);
    await expect(restartedPage.getByTestId('requirement-item')).toHaveCount(expected.requirementCount);
    await expect(restartedPage.getByTestId('coverage-summary')).toContainText('0 / 2');
    await expect(restartedPage.getByTestId('coverage-orphan-count')).toContainText('1 条失联');
    await expect(restartedPage.getByTestId('binding-chip')).toHaveAttribute('data-orphan', expected.orphan);
    await expect(restartedPage.getByTestId('checklist-progress')).toHaveText(expected.checklist);

    // 用例结束清理：清空该上下文工作区数据后关闭
    await restartedPage.goto('/jobs');
    await restartedPage.evaluate(() => window.localStorage.clear());
    await restarted.close();
  });

  test('场景：真实文件导出 → 全新上下文导入（含失联绑定），岗位、覆盖率、检查进度一致', async ({
    browser,
  }) => {
    const contextA = await freshContext(browser);
    const pageA = await contextA.newPage();

    const { jobPath, resumeId } = await seedJobFlow(pageA, {
      title: '备份往返岗位',
      company: '备份公司',
      requirements: ['备份要求一', '备份要求二'],
    });
    await deleteFirstWorkExperience(pageA, resumeId);
    await pageA.goto(jobPath);
    await expect(pageA.getByTestId('binding-chip')).toHaveAttribute('data-orphan', 'true');
    await expect(pageA.getByTestId('coverage-orphan-count')).toContainText('1 条失联');

    // 真实点击「导出 JSON」，拿到下载文件并解析
    await pageA.goto('/resumes');
    const downloadPromise = pageA.waitForEvent('download');
    await pageA.getByTestId('export-json').click();
    const download = await downloadPromise;
    // 下载产物会随原上下文关闭而清理，先保存到稳定的用例输出目录
    const roundtripPath = test.info().outputPath('workspace-roundtrip.json');
    await download.saveAs(roundtripPath);
    const backup = JSON.parse(readFileSync(roundtripPath, 'utf-8')) as {
      jobs: unknown[];
      resumes: unknown[];
    };
    expect(backup.jobs).toHaveLength(1);
    expect(backup.resumes.length).toBeGreaterThanOrEqual(1);

    // 关闭原上下文（模拟在另一台/另一个干净浏览器环境恢复）
    await contextA.close();

    const contextB = await freshContext(browser);
    const pageB = await contextB.newPage();
    await pageB.goto('/resumes');
    // 真实选择备份文件上传：走与页面完全相同的解析 + 写入 + reload 路径，并等待 reload 落定
    await importBackupFile(pageB, roundtripPath);

    // 简历保留
    await expect(pageB.getByRole('link', { name: /编辑/ }).first()).toBeVisible();

    // 岗位与失联状态、覆盖率、检查进度一致
    await pageB.goto('/jobs');
    await pageB.getByRole('link', { name: '查看匹配' }).first().click();
    await pageB.waitForURL(/\/jobs\/.+/);
    await expect(pageB.getByTestId('requirement-item')).toHaveCount(2);
    await expect(pageB.getByTestId('binding-chip')).toHaveCount(1);
    await expect(pageB.getByTestId('binding-chip')).toHaveAttribute('data-orphan', 'true');
    await expect(pageB.getByTestId('coverage-summary')).toContainText('0 / 2');
    await expect(pageB.getByTestId('coverage-orphan-count')).toContainText('1 条失联');
    await expect(pageB.getByTestId('checklist-progress')).toHaveText('1/5');
    await expect(pageB.locator('input[aria-label="岗位名称"]')).toHaveValue('备份往返岗位');

    await pageB.evaluate(() => window.localStorage.clear());
    await contextB.close();
  });

  test('场景：旧备份缺少岗位数据时，岗位恢复为空但简历全部保留，且应用正常打开', async ({
    browser,
  }) => {
    const contextA = await freshContext(browser);
    const pageA = await contextA.newPage();
    await pageA.goto('/resumes');
    await expect(pageA.getByRole('link', { name: /编辑/ }).first()).toBeVisible();

    // 导出当前工作区，手工删除 jobs 字段，模拟旧版本应用产出的备份
    const downloadPromise = pageA.waitForEvent('download');
    await pageA.getByTestId('export-json').click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    const backup = JSON.parse(readFileSync(downloadPath!, 'utf-8')) as Record<string, unknown>;
    const resumeCount = (backup.resumes as unknown[]).length;
    expect(resumeCount).toBeGreaterThanOrEqual(1);
    delete backup.jobs;
    const oldBackupPath = test.info().outputPath('old-backup-without-jobs.json');
    writeFileSync(oldBackupPath, JSON.stringify(backup), 'utf-8');
    await contextA.close();

    // 干净上下文导入旧备份
    const contextB = await freshContext(browser);
    const pageB = await contextB.newPage();
    await pageB.goto('/resumes');
    await importBackupFile(pageB, oldBackupPath);

    // 简历一条不丢
    await expect(pageB.getByRole('link', { name: /编辑/ })).toHaveCount(resumeCount);

    // 岗位匹配中心正常打开，只是空列表（无「查看匹配」入口）
    await pageB.goto('/jobs');
    await expect(pageB.getByRole('heading', { name: '还没有目标岗位' })).toBeVisible();
    await expect(pageB.getByRole('link', { name: '查看匹配' })).toHaveCount(0);

    await pageB.evaluate(() => window.localStorage.clear());
    await contextB.close();
  });
});
