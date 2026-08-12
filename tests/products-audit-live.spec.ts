import { test, expect } from '@playwright/test';

test('Auditoría detallada del servidor en vivo localhost:5174', async ({ page }) => {
  const requests: { url: string; status: number; body?: string }[] = [];
  const consoleLogs: { type: string; text: string }[] = [];

  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      let body = '';
      try { body = await response.text(); } catch {}
      requests.push({
        url: response.url(),
        status: response.status(),
        body: body.slice(0, 300)
      });
    }
  });

  // Inject session
  await page.addInitScript(() => {
    window.localStorage.setItem('escapesymas_admin_session', JSON.stringify({
      token: 'test-token',
      user_id: '1',
      user_email: 'admin@escapesymas.com'
    }));
  });

  await page.goto('http://localhost:5174');
  await page.waitForLoadState('networkidle');

  // Click Products tab
  await page.getByRole('button', { name: 'Productos', exact: true }).click();
  await page.waitForTimeout(1000);

  // Take screenshot
  await page.screenshot({ path: 'tests/products-live-screenshot.png', fullPage: true });

  console.log('=== LOGS DE CONSOLA ===');
  console.dir(consoleLogs, { depth: null });

  console.log('=== PETICIONES DE RED API ===');
  console.dir(requests, { depth: null });
});
