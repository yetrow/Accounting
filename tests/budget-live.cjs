const { chromium, expect } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright/test' : 'playwright/test');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
let browser, server;
const url = 'http://127.0.0.1:3018';
before(async () => {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '3018', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { await fetch(url); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); server?.kill(); });
const snapshot = () => ({
  categories: [{ name: '餐饮', color: '#E8927C' }], budgets: { '2026-10': 1200, '2026-11': 900 },
  expenses: [{ id: 'past', amount: 249.85, category: '餐饮', date: '2026-10-03', createdAt: 1 },
    { id: 'today', amount: 5, category: '餐饮', date: '2026-10-04', createdAt: 2 },
    { id: 'last-month', amount: 99, category: '餐饮', date: '2026-09-30', createdAt: 0 }]
});
async function open(data = snapshot(), time = '2026-10-04T10:00:00+08:00') {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, timezoneId: 'Asia/Shanghai' });
  await page.clock.install({ time: new Date(time) });
  await page.goto(url);
  await page.evaluate(data => { localStorage.clear(); localStorage.setItem('ledger.snapshot.v2', JSON.stringify(data)); }, data);
  await page.reload();
  return page;
}
// Locate the existing card without requiring any new test-only markup.
const card = page => page.getByRole('button', { name: '修改预算', exact: true }).locator('../..');
async function amounts(page, spent, remaining, daily) {
  await expect(card(page).getByText(`¥${spent}`, { exact: true })).toBeVisible();
  await expect(card(page).getByText(`¥${remaining}`, { exact: true })).toBeVisible();
  await expect(card(page).getByText(`¥${daily}`, { exact: true })).toBeVisible();
}
test('saving a purchase immediately updates remaining budget and daily allowance without reload', async () => {
  const page = await open();
  try {
    await expect(card(page).getByText('¥254.85', { exact: true })).toBeVisible();
    await expect(card(page).getByText('¥33.76', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.getByRole('button', { name: '记一笔', exact: true }).click();
    await expect(card(page).getByText('¥259.85', { exact: true })).toBeVisible();
    await expect(card(page).getByText('¥33.58', { exact: true })).toBeVisible();
    await expect(card(page).getByText('本月剩余预算', { exact: true })).toBeVisible();
    await amounts(page, '259.85', '940.15', '33.58');
    await page.reload();
    await amounts(page, '259.85', '940.15', '33.58');
  } finally { await page.close(); }
});
test('editing, moving a bill to another month, deleting, changing budget and importing update the card', async () => {
  const page = await open();
  try {
    const list = page.getByRole('region', { name: '账单流水', exact: true });
    await list.getByRole('button', { name: '编辑账单' }).click();
    await page.getByLabel('金额（元）').fill('15');
    await page.getByRole('button', { name: '保存修改' }).click();
    await amounts(page, '264.85', '935.15', '33.40');
    await list.getByRole('button', { name: '编辑账单' }).click();
    await page.getByRole('dialog').getByLabel('日期', { exact: true }).fill('2026-09-30');
    await page.getByRole('button', { name: '保存修改' }).click();
    await amounts(page, '249.85', '950.15', '33.93');
    await list.getByRole('button', { name: '昨天', exact: true }).click();
    await list.getByRole('button', { name: '删除账单' }).click();
    await list.getByRole('button', { name: '确认删除' }).click();
    await amounts(page, '0.00', '1200.00', '42.86');
    await page.getByRole('button', { name: '修改预算', exact: true }).click();
    await page.getByPlaceholder('如 900，留空为取消预算').fill('1400');
    await page.getByRole('button', { name: '确定', exact: true }).click();
    await amounts(page, '0.00', '1400.00', '50.00');
    await page.getByRole('button', { name: '数据管理', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'budget.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snapshot())) });
    await page.getByRole('button', { name: '确认覆盖导入' }).click();
    await amounts(page, '254.85', '945.15', '33.76');
    await page.getByRole('button', { name: '恢复导入前数据' }).click();
    await page.getByRole('button', { name: '确认恢复', exact: true }).click();
    await amounts(page, '0.00', '1400.00', '50.00');
  } finally { await page.close(); }
});
test('budget refreshes across midnight and month rollover, including returning from background', async () => {
  const page = await open(snapshot(), '2026-10-30T23:59:59+08:00');
  try {
    await expect(card(page).getByText('¥472.57', { exact: true })).toBeVisible();
    await page.clock.fastForward(2000);
    await expect(card(page).getByText('剩余 1 天，每天还能花', { exact: true })).toBeVisible();
    await page.clock.setSystemTime(new Date('2026-11-01T08:00:00+08:00'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await amounts(page, '0.00', '900.00', '30.00');
    await expect(card(page).getByText('11 月预算', { exact: true })).toBeVisible();
  } finally { await page.close(); }
});
test('exact budget exhaustion has no floating-point overspend; true overspend stays readable on phones', async () => {
  const data = snapshot(); data.budgets['2026-10'] = .3;
  data.expenses = data.expenses.slice(0, 2).map((e, i) => ({ ...e, amount: i ? .2 : .1 }));
  const page = await open(data);
  try {
    await expect(card(page).getByText('本月预算已用完', { exact: true })).toBeVisible();
    assert.equal(await card(page).getByText('已超出预算', { exact: true }).count(), 0);
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: '记一笔', exact: true }).click();
    await expect(card(page).getByText('已超出预算', { exact: true })).toBeVisible();
    await expect(card(page).getByText('¥1.00', { exact: true })).toBeVisible();
    for (const width of [320, 393, 430]) {
      await page.setViewportSize({ width, height: 852 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
  } finally { await page.close(); }
});
