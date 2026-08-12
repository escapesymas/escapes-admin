import { test, expect } from '@playwright/test';

// Test session payload
const mockSession = {
  token: 'mock-test-admin-jwt-token-12345',
  user_id: '1',
  user_email: 'admin@escapesymas.com',
  user: { id: 1, email: 'admin@escapesymas.com', role: 'admin' }
};

test.describe('Navegación y Auditoría Integral de Módulos - Escapes Admin', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept all API routes
    await page.route('**/api/admin**', async route => {
      const url = new URL(route.request().url());
      const action = url.searchParams.get('action');

      if (action === 'dashboard-stats') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            sales: 12500,
            orders: 45,
            users: 120,
            posts: 15,
            vps: {
              cores: 4,
              cpu: 18,
              ramUsed: '2.1GB',
              ramTotal: '8.0GB',
              ramPercent: 26,
              disk: { used: '15GB', total: '100GB', percent: '15%' },
              os: 'Ubuntu 24.04 LTS',
              uptime: '15d 4h'
            }
          })
        });
      }

      if (action === 'shipping-zones-list') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 1, name: 'Península', regions: ['ES'], methods: [{ id: 1, zone_id: 1, name: 'Estándar', cost: 499, active: 1 }] }
          ])
        });
      }

      if (action === 'coupons-list') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 1, code: 'WELCOME10', type: 'percent', value: 10, times_used: 5, max_uses: 100, active: 1 }
          ])
        });
      }

      if (action === 'seo-autolinks-list') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 1, keyword: 'Akrapovic', url: '/escapes/akrapovic', active: 1 }
          ])
        });
      }

      if (action === 'pricing-rules-list') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 1, rule_type: 'global', target_id: 'all', margin_percent: 20 }
          ])
        });
      }

      if (action === 'financial-analytics') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            period: '30d',
            summary: {
              totalOrders: 15,
              grossRevenue: 150000,
              totalShipping: 7500,
              totalDiscounts: 1500,
              avgOrderValue: 10000,
              cogs: 90000,
              grossProfit: 60000,
              vatCollected: 31500,
              taxBase: 118500
            },
            prevPeriod: { grossRevenue: 120000, totalOrders: 12 },
            revenueByDay: [],
            topProducts: [],
            statusBreakdown: []
          })
        });
      }

      if (action === 'invoices-list') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/bihr/**', async route => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          catalog: { status: 'idle' },
          images: { status: 'idle', running: false, processed: 100, total: 500, success: 98, failed: 2, skipped: 0 }
        })
      });
    });

    await page.addInitScript((session) => {
      window.localStorage.setItem('escapesymas_admin_session', JSON.stringify(session));
    }, mockSession);

    await page.goto('http://localhost:5174/');
    await page.waitForLoadState('networkidle');
  });

  test('1. Módulo Panel de Control (Dashboard)', async ({ page }) => {
    await expect(page.getByText('Ventas Totales')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Telemetría del Servidor')).toBeVisible();
  });

  test('2. Módulo Pedidos: Filtros de Estado y Búsqueda', async ({ page }) => {
    await page.getByRole('button', { name: 'Pedidos' }).click();
    const searchInput = page.getByPlaceholder(/Buscar pedidos/i);
    await expect(searchInput).toBeVisible();

    await page.click('button:has-text("Pendiente")');
    await page.click('button:has-text("Completado")');
    await page.click('button:has-text("Todos")');
  });

  test('3. Módulo Usuarios: Búsqueda y Filtro por Rol', async ({ page }) => {
    await page.getByRole('button', { name: 'Usuarios' }).click();
    const searchInput = page.getByPlaceholder(/Buscar usuarios por nombre/i);
    await expect(searchInput).toBeVisible();

    await page.click('button:has-text("Clientes")');
    await page.click('button:has-text("Admins")');
    await page.click('button:has-text("Todos")');
  });

  test('4. Módulo Cupones: Modal de Creación', async ({ page }) => {
    await page.getByRole('button', { name: 'Cupones' }).click();
    await expect(page.getByText('Marketing y Cupones')).toBeVisible();
    await page.click('button:has-text("Crear Cupón")');
    await expect(page.getByText('Nuevo Cupón')).toBeVisible();
  });

  test('5. Módulo Tarifas de Envío', async ({ page }) => {
    await page.getByRole('button', { name: 'Envíos y Tarifas' }).click();
    await expect(page.locator('h1', { hasText: 'Zonas y Tarifas de Envío' })).toBeVisible();
  });

  test('6. Módulo SEO Manager', async ({ page }) => {
    await page.getByRole('button', { name: 'SEO Manager' }).click();
    await expect(page.getByText('Añadir Palabra Clave')).toBeVisible();
  });

  test('7. Módulo Consola Bihr (Sincronización)', async ({ page }) => {
    await page.getByRole('button', { name: 'Sincronización' }).click();
    await expect(page.getByText('Sincronización del Catálogo')).toBeVisible();
    await expect(page.getByText('Descargador y Optimizador')).toBeVisible();
  });

  test('8. Módulo Precios y Márgenes', async ({ page }) => {
    await page.getByRole('button', { name: 'Precios y Márgenes' }).click();
    await expect(page.getByText('Recálculo Masivo de Tarifas')).toBeVisible();
    await expect(page.getByText('Crear Regla de Margen')).toBeVisible();
  });

  test('9. Módulo Contabilidad y Facturación', async ({ page }) => {
    await page.getByRole('button', { name: 'Contabilidad' }).click();
    await expect(page.locator('h1', { hasText: 'Contabilidad y Facturación' })).toBeVisible();
    await page.click('button:has-text("Facturas")');
    await page.click('button:has-text("Analíticas")');
  });
});
