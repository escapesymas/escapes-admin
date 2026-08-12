import { test, expect } from '@playwright/test';

test('Smoke test localhost:5174', async ({ page }) => {
  await page.goto('http://localhost:5174');
  console.log('Title:', await page.title());
  expect(await page.title()).toBeTruthy();
});
