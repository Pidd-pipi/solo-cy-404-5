import { Page, expect } from '@playwright/test';

/**
 * 从真实页面入口完成一段岗位匹配数据的写入：
 * /jobs → 新建岗位（主投简历默认选中预置简历）→ 进入详情 →
 * 添加要求 → 为第一条要求绑定一条「工作经历」证据 → 勾选第一项投递前检查。
 * 返回岗位详情路径与主投简历 id。
 */
export async function seedJobFlow(
  page: Page,
  options: { title: string; company: string; requirements: string[] },
): Promise<{ jobPath: string; resumeId: string }> {
  await page.goto('/jobs');
  await page.getByTestId('create-job-button').click();

  await page.getByTestId('job-title-input').fill(options.title);
  await page.getByTestId('job-company-input').fill(options.company);
  await page.getByTestId('job-create-submit').click();

  // 创建后停留在列表页，点进该岗位详情
  await page.getByRole('link', { name: '查看匹配' }).first().click();
  await page.waitForURL(/\/jobs\/.+/);
  const jobPath = new URL(page.url()).pathname;

  for (const text of options.requirements) {
    await page.getByTestId('requirement-input').fill(text);
    await page.getByTestId('requirement-input').press('Enter');
  }

  // 第一条要求：打开证据选择器（默认在「工作经历」分类），绑定第一条未绑定条目
  const firstRequirement = page.getByTestId('requirement-item').first();
  await firstRequirement.getByTestId('bind-evidence').click();
  await page.getByTestId('picker-entry').first().click();
  await expect(firstRequirement.getByTestId('binding-chip')).toBeVisible();

  // 勾选第一项投递前检查
  await page.getByTestId('check-toggle').first().click();
  await expect(page.getByTestId('check-item').first()).toHaveAttribute('data-status', 'done');

  const resumeId = await page.inputValue('[data-testid="job-target-resume"]');
  return { jobPath, resumeId };
}

/** 在简历编辑器中把第一条工作经历的公司改名（id 不变，验证改名追踪） */
export async function renameFirstWorkCompany(page: Page, resumeId: string, newName: string): Promise<void> {
  await page.goto(`/resumes/${resumeId}/edit`);
  await page.getByRole('button', { name: '工作经历', exact: true }).click();
  await page.getByLabel('公司名称').first().fill(newName);
}

/** 在简历编辑器中删除第一条工作经历（验证条目移除失联） */
export async function deleteFirstWorkExperience(page: Page, resumeId: string): Promise<void> {
  await page.goto(`/resumes/${resumeId}/edit`);
  await page.getByRole('button', { name: '工作经历', exact: true }).click();
  await page.getByRole('button', { name: '删除经历' }).first().click();
  await expect(page.getByLabel('公司名称')).toHaveCount(1);
}

export async function clearWorkspace(page: Page): Promise<void> {
  await page.goto('/jobs');
  await page.evaluate(() => window.localStorage.clear());
}
