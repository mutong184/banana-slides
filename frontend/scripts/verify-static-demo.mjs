import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch({ headless: true, channel: process.env.DEMO_BROWSER || 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const forbiddenRequests = [], errors = [];
page.on('request', request => {
  const url = new URL(request.url());
  if (url.pathname.startsWith('/api/') || /codia\.ai|aihubmix|googleapis/.test(url.hostname)) forbiddenRequests.push(url.href);
});
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await mkdir('test-results/static-replay', { recursive: true });
try {
  await page.clock.install();
  await page.goto('http://127.0.0.1:3012/');
  await expect(page.getByText('已选择', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '开始多轮对话生成 PPT', exact: true }).click();
  await page.locator('iframe').waitFor();
  const frame = page.frameLocator('iframe');
  await frame.locator('textarea').waitFor();
  await page.clock.runFor(300000);
  for (const answer of [
    '请面向小学五年级，围绕摆的快慢设计课堂课件，探究摆长与摆动快慢的关系。',
    '问题导入、学生猜想、控制变量实验、数据分析与总结。',
    '40分钟，分组实验，学生已认识摆。',
    '使用摆绳、摆锤和秒表，改变摆长，保持摆锤质量和摆幅一致。',
    '希望学生会控制变量，重复测量，依据证据解释。',
    '采用科学实验室风格，15页课件，投影展示。',
    '已经确认，请继续。',
  ]) {
    if (await frame.locator('textarea').count()) {
      await frame.locator('textarea').fill(answer);
      await frame.locator('textarea').press('Enter');
      await page.clock.runFor(300000);
    }
  }
  await frame.getByRole('button', { name: '应用到 PPT 需求', exact: true }).click();
  await page.waitForURL('**/outline');
  await page.clock.resume();
  await expect(page.getByText('共 15 页', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/static-replay/outline.png' });
  await page.getByRole('button', { name: /下一步/ }).click();
  await expect(page.getByText(/正在生成页面描述（\d+\/15）/)).toBeVisible();
  await page.screenshot({ path: 'test-results/static-replay/description-progress.png' });
  await page.waitForURL('**/preview');
  await page.waitForTimeout(1500);
  await page.reload(); // Verify that an interrupted image replay resumes.
  await expect.poll(async () => page.evaluate(() => {
    const data = JSON.parse(sessionStorage.getItem('ppt-edit-static-replay-v1'));
    return data?.project.pages.filter(p => p.status === 'COMPLETED').length;
  }), { timeout: 20000 }).toBe(15);
  await expect(page.locator('img[src*="static-demo/slides/01.png"]').last()).toBeVisible();
  await page.screenshot({ path: 'test-results/static-replay/preview.png' });
  await page.getByRole('button').filter({ hasText: '导出' }).first().click();
  await page.getByRole('button', { name: '导出可编辑 PPTX', exact: true }).click();
  await expect(page.getByText('PPTX 文件支持在 PowerPoint 等软件中继续编辑。')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '开始导出', exact: true }).click();
  await expect(page.getByText('正在准备可编辑 PPTX…')).toBeVisible();
  await page.screenshot({ path: 'test-results/static-replay/export-progress.png' });
  const download = await downloadPromise;
  await download.saveAs('test-results/static-replay/downloaded.pptx');
  assert.equal(await download.failure(), null);
  const hash = file => readFile(file).then(bytes => createHash('sha256').update(bytes).digest('hex'));
  assert.equal(await hash('test-results/static-replay/downloaded.pptx'), await hash('public/static-demo/editable-example.pptx'));
  assert.deepEqual(forbiddenRequests, [], 'No AI, backend or conversion requests may leave the browser');
  assert.deepEqual(errors, [], 'The replay must finish without browser errors');
  console.log('PASS: home → teaching dialogue → apply → 15-page outline → descriptions → images → refresh recovery → editable PPTX download. Zero API requests; downloaded file hash matches local asset.');
} finally {
  await browser.close();
}
