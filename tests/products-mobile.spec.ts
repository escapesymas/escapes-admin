import { test, expect } from '@playwright/test';

// Configure mobile viewport (iPhone 13 / Android mobile size)
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

const mockSession = {
  token: 'mock-test-admin-jwt-token-12345',
  user_id: '1',
  user_email: 'admin@escapesymas.com',
  user: { id: 1, email: 'admin@escapesymas.com', role: 'admin' }
};

const mockProducts = [
  {
    id: 101,
    name: 'Escape Akrapovic Slip-On Titanium',
    sku: 'AKRA-S-Y10SO15-HAPT',
    brand: 'Akrapovic',
    price: 85000, // 850.00 EUR
    sale_price: 79900,
    cost: 55000,
    stock: 5,
    status: 'published',
    dropshipping: true,
    ondemand: false,
    barcode: '3831113524901',
    supplier_code: 'AK-9921',
    delivery_plant: 'BCN-01',
    weight_g: 2400,
    length_mm: 450,
    width_mm: 150,
    height_mm: 150,
    description: 'Sistema de escape Slip-On en titanio homologado para Yamaha YZF-R1. Máximo rendimiento y sonido deportivo.',
    images: [{ url: 'https://via.placeholder.com/400?text=Akrapovic+Mobile', alt: 'Escape Akrapovic' }],
    compatibility: [
      { brand: 'Yamaha', model: 'YZF-R1', year: '2020-2024' },
      { brand: 'Yamaha', model: 'MT-10', year: '2022-2024' }
    ],
    created_at: '2026-01-15T10:00:00Z',
    category_id: 1
  },
  {
    id: 102,
    name: 'Pastillas de Freno Brembo Z04',
    sku: 'BREM-Z04-07BB37',
    brand: 'Brembo',
    price: 12000,
    sale_price: null,
    cost: 8000,
    stock: 0,
    status: 'out_of_stock',
    dropshipping: false,
    ondemand: true,
    barcode: '8020900000000',
    supplier_code: 'BR-7712',
    delivery_plant: 'MAD-02',
    weight_g: 450,
    description: 'Compuesto de competición Z04 para pinza monobloque.',
    images: [],
    compatibility: [{ brand: 'BMW', model: 'S1000RR', year: '2019-2024' }],
    created_at: '2026-02-01T12:00:00Z',
    category_id: 2
  }
];

test.describe('Pruebas en Móvil - Módulo de Productos y Modal de Detalle', () => {
  const consoleErrors: string[] = [];
  const uncaughtExceptions: Error[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    uncaughtExceptions.length = 0;

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    page.on('pageerror', exception => uncaughtExceptions.push(exception));

    // Mock backend responses
    await page.route('**/api/admin**', async route => {
      const url = new URL(route.request().url());
      const action = url.searchParams.get('action');

      if (action === 'products-list') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ products: mockProducts, total: mockProducts.length })
        });
      }

      if (action === 'get-categories') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 1, name: 'Escapes', parent_id: null }])
        });
      }

      if (action === 'product-detail') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            product: mockProducts[0],
            stats: {
              all_time: { units_sold: 24, revenue_cents: 2040000, order_count: 20 },
              current_30d: { units_sold: 6, revenue_cents: 510000, order_count: 5 },
              previous_30d: { units_sold: 4, revenue_cents: 340000, order_count: 4 },
              delta: { units_pct: 50.0, revenue_pct: 50.0 },
              daily_30d: Array.from({ length: 30 }, (_, i) => ({
                date: `2026-07-${String(i + 1).padStart(2, '0')}`,
                units: i % 4 === 0 ? 2 : 0,
                revenue_cents: i % 4 === 0 ? 170000 : 0,
                order_count: i % 4 === 0 ? 1 : 0
              })),
              margin_cents: 720000,
              margin_pct: 35.2,
              cogs_cents: 1320000,
              stock_turnover: 4.8,
              return_rate_pct: 0,
              refunded_orders: 0,
              total_orders_with_product: 20,
              avg_order_total_cents: 102000
            },
            recent_orders: [
              {
                order_id: 8091,
                created_at: '2026-08-10T14:20:00Z',
                status: 'completed',
                total_cents: 85000,
                quantity: 1,
                unit_price_cents: 85000,
                customer_email: 'movil.cliente@escapesymas.com'
              }
            ],
            live_stock: { quantity: 5, status: 'En Stock Bihr' }
          })
        });
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.addInitScript((session) => {
      window.localStorage.setItem('escapesymas_admin_session', JSON.stringify(session));
    }, mockSession);

    await page.goto('http://localhost:5174');
  });

  test.afterEach(() => {
    expect(uncaughtExceptions).toEqual([]);
  });

  test('Flujo completo en Móvil: Menú lateral, listado, scroll y modal de detalles con estadísticas', async ({ page }) => {
    // 1. Verificar cabecera móvil
    const menuBtn = page.getByRole('button', { name: 'Abrir Menú' });
    await expect(menuBtn).toBeVisible();

    // 2. Abrir menú hamburguesa móvil
    await menuBtn.click();

    // 3. Seleccionar "Productos" en el cajón lateral móvil
    const mobileProductsNav = page.locator('aside button', { hasText: 'Productos' });
    await expect(mobileProductsNav).toBeVisible();
    await mobileProductsNav.click();

    // 4. Verificar título de productos
    await expect(page.locator('h1')).toContainText('Catálogo de Productos');

    // Screenshot del catálogo en móvil
    await page.screenshot({ path: 'tests/screenshots/mobile-catalog.png' });

    // 5. Hacer scroll en la vista del catálogo móvil
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(300);

    // 6. Hacer clic en el nombre/imagen del producto para abrir el modal de detalles
    const productTitleBtn = page.locator('button', { hasText: 'Escape Akrapovic Slip-On Titanium' });
    await expect(productTitleBtn).toBeVisible();
    await productTitleBtn.click();

    // 7. Verificar que el modal de detalle se abre correctamente
    const modalHeader = page.locator('text=Detalle de Producto');
    await expect(modalHeader).toBeVisible();

    // Take screenshot of mobile product detail modal top
    await page.screenshot({ path: 'tests/screenshots/mobile-modal-top.png' });

    // 8. Hacer scroll dentro del contenido desplazable del modal
    const modalContent = page.locator('div.fixed.inset-0 .overflow-y-auto');
    await expect(modalContent).toBeVisible();
    await modalContent.evaluate(el => el.scrollBy(0, 300));
    await page.waitForTimeout(300);

    // Screenshot scroll down stats
    await page.screenshot({ path: 'tests/screenshots/mobile-modal-stats.png' });

    // 9. Probar cambio de pestañas dentro del modal (Ventas -> Detalles -> Compatibilidad)
    // Pestaña Detalles
    await page.locator('button', { hasText: 'Detalles' }).click();
    await expect(page.locator('text=Descripción')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/mobile-modal-tab-details.png' });

    // Pestaña Compatibilidad
    await page.locator('button', { hasText: 'Compatibilidad' }).click();
    await expect(page.locator('div.fixed td', { hasText: 'Yamaha' }).first()).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/mobile-modal-tab-compat.png' });

    // Volver a Ventas
    await page.locator('button', { hasText: 'Ventas' }).click();
    await expect(page.locator('text=Unidades (30d)')).toBeVisible();

    // 10. Cerrar el modal mediante el botón de cierre (X)
    const closeBtn = page.locator('button[aria-label="Cerrar"]');
    await closeBtn.click();

    // Modal debe haberse cerrado
    await expect(modalHeader).toBeHidden();
  });
});
