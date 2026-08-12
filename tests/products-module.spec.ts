import { test, expect } from '@playwright/test';

// Test session payload
const mockSession = {
  token: 'mock-test-admin-jwt-token-12345',
  user_id: '1',
  user_email: 'admin@escapesymas.com',
  user: {
    id: 1,
    email: 'admin@escapesymas.com',
    role: 'admin'
  }
};

// Mock products data
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
    description: 'Sistema de escape Slip-On en titanio homologado para Yamaha YZF-R1.',
    images: [{ url: 'https://via.placeholder.com/400?text=Akrapovic', alt: 'Escape Akrapovic' }],
    compatibility: [{ brand: 'Yamaha', model: 'YZF-R1', year: '2020-2024' }],
    created_at: '2026-01-15T10:00:00Z',
    category_id: 1,
    category2_id: null,
    category3_id: null
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
    length_mm: 100,
    width_mm: 50,
    height_mm: 20,
    description: 'Compuesto de competición Z04 para pinza monobloque.',
    images: [],
    compatibility: [{ brand: 'BMW', model: 'S1000RR', year: '2019-2024' }],
    created_at: '2026-02-01T12:00:00Z',
    category_id: 2,
    category2_id: null,
    category3_id: null
  }
];

// Mock attributes data
const mockAttributes = [
  {
    id: 1,
    name: 'Talla',
    slug: 'talla',
    terms: [
      { id: 10, attribute_id: 1, name: 'S', slug: 's' },
      { id: 11, attribute_id: 1, name: 'M', slug: 'm' },
      { id: 12, attribute_id: 1, name: 'L', slug: 'l' }
    ]
  },
  {
    id: 2,
    name: 'Color',
    slug: 'color',
    terms: [
      { id: 20, attribute_id: 2, name: 'Negro Mate', slug: 'negro-mate' },
      { id: 21, attribute_id: 2, name: 'Carbono', slug: 'carbono' }
    ]
  }
];

// Mock categories data
const mockCategories = [
  { id: 1, name: 'Escapes', parent_id: null },
  { id: 2, name: 'Frenos', parent_id: null },
  { id: 10, name: 'Escapes Completo', parent_id: 1 }
];

test.describe('Modulo de Productos - Escapes Admin', () => {
  const consoleErrors: string[] = [];
  const uncaughtExceptions: Error[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    uncaughtExceptions.length = 0;

    // Track console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[Browser Console Error] ${msg.text()}`);
      }
    });

    // Track page errors
    page.on('pageerror', exception => {
      uncaughtExceptions.push(exception);
    });

    // Mock API requests
    await page.route('**/api/admin**', async route => {
      const url = new URL(route.request().url());
      const action = url.searchParams.get('action');

      if (action === 'products-list') {
        const search = url.searchParams.get('search') || '';
        const filtered = mockProducts.filter(p =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.sku.toLowerCase().includes(search.toLowerCase())
        );
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ products: filtered, total: filtered.length })
        });
      }

      if (action === 'get-categories') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCategories)
        });
      }

      if (action === 'get-attributes') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAttributes)
        });
      }

      if (action === 'get-vehicle-brands') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 1, name: 'Yamaha' }, { id: 2, name: 'BMW' }])
        });
      }

      if (action === 'get-vehicle-models') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 1, brand_name: 'Yamaha', name: 'YZF-R1' },
            { id: 2, brand_name: 'BMW', name: 'S1000RR' }
          ])
        });
      }

      if (action === 'product-detail') {
        const id = Number(url.searchParams.get('id'));
        const product = mockProducts.find(p => p.id === id) || mockProducts[0];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            product,
            stats: {
              all_time: { units_sold: 12, revenue_cents: 1020000, order_count: 10 },
              current_30d: { units_sold: 3, revenue_cents: 255000, order_count: 3 },
              previous_30d: { units_sold: 2, revenue_cents: 170000, order_count: 2 },
              delta: { units_pct: 50.0, revenue_pct: 50.0 },
              daily_30d: Array.from({ length: 30 }, (_, i) => ({
                date: `2026-07-${String(i + 1).padStart(2, '0')}`,
                units: i % 5 === 0 ? 1 : 0,
                revenue_cents: i % 5 === 0 ? 85000 : 0,
                order_count: i % 5 === 0 ? 1 : 0
              })),
              margin_cents: 360000,
              margin_pct: 35.2,
              cogs_cents: 660000,
              stock_turnover: 2.4,
              return_rate_pct: 0,
              refunded_orders: 0,
              total_orders_with_product: 10,
              avg_order_total_cents: 102000
            },
            recent_orders: [
              {
                order_id: 5001,
                created_at: '2026-08-01T15:30:00Z',
                status: 'completed',
                total_cents: 85000,
                quantity: 1,
                unit_price_cents: 85000,
                customer_email: 'cliente@ejemplo.com'
              }
            ],
            live_stock: { quantity: 5, status: 'In stock' }
          })
        });
      }

      if (action === 'create-product' || action === 'update-product') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }

      if (action === 'delete-product') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }

      if (action === 'add-attribute' || action === 'add-attribute-term') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }

      // Default response for other endpoints
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    // Set localStorage session before page load
    await page.addInitScript((session) => {
      window.localStorage.setItem('escapesymas_admin_session', JSON.stringify(session));
    }, mockSession);

    // Go to base page
    await page.goto('http://localhost:5174');
  });

  test.afterEach(() => {
    // Assert no uncaught JS exceptions occurred
    expect(uncaughtExceptions).toEqual([]);
  });

  test('1. Renderiza correctamente el Panel y navega al Modulo de Productos', async ({ page }) => {
    // Click on "Productos" nav item in sidebar
    const productsNavBtn = page.getByRole('button', { name: 'Productos', exact: true });
    await expect(productsNavBtn).toBeVisible();
    await productsNavBtn.click();

    // Check header
    await expect(page.locator('h1')).toContainText('Catálogo de Productos');

    // Check table rows
    await expect(page.locator('table tbody tr')).toHaveCount(mockProducts.length);
    await expect(page.locator('text=Escape Akrapovic Slip-On Titanium')).toBeVisible();
    await expect(page.locator('text=Pastillas de Freno Brembo Z04')).toBeVisible();
  });

  test('2. Búsqueda automática y debounced en el catálogo', async ({ page }) => {
    await page.getByRole('button', { name: 'Productos', exact: true }).click();

    const searchInput = page.locator('input[placeholder*="Buscar por nombre"]');
    await expect(searchInput).toBeVisible();

    // Search for "Akrapovic"
    await searchInput.fill('Akrapovic');
    await page.waitForTimeout(450); // wait for 300ms debounce

    await expect(page.locator('text=Escape Akrapovic Slip-On Titanium')).toBeVisible();
    await expect(page.locator('text=Pastillas de Freno Brembo Z04')).toBeHidden();

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(450);
    await expect(page.locator('text=Pastillas de Freno Brembo Z04')).toBeVisible();
  });

  test('3. Selector de columnas visibles en la tabla', async ({ page }) => {
    await page.getByRole('button', { name: 'Productos', exact: true }).click();

    const columnsBtn = page.locator('button', { hasText: 'Columnas' });
    await columnsBtn.click();

    // Toggle 'Código Barras' column
    const barcodeCheckbox = page.locator('label', { hasText: 'Código Barras' }).locator('input[type="checkbox"]');
    await barcodeCheckbox.check();

    // Header should now include 'Cód. Barras'
    await expect(page.locator('th', { hasText: 'Código Barras' })).toBeVisible();

    // Uncheck 'Brand'
    const brandCheckbox = page.locator('label', { hasText: 'Marca' }).locator('input[type="checkbox"]');
    await brandCheckbox.uncheck();

    await expect(page.locator('th', { hasText: 'Marca' })).toBeHidden();
  });

  test('4. Desplegable de filtros avanzados', async ({ page }) => {
    await page.getByRole('button', { name: 'Productos', exact: true }).click();

    const filtersBtn = page.locator('button', { hasText: 'Filtros' });
    await filtersBtn.click();

    // Filter panel should open
    await expect(page.locator('label', { hasText: 'MARCA' })).toBeVisible();
    await expect(page.locator('label', { hasText: 'ESTADO' })).toBeVisible();
    await expect(page.locator('label', { hasText: 'PRECIO MÍN (€)' })).toBeVisible();

    // Fill filter
    await page.locator('input[placeholder="Ej. NGK"]').fill('Akrapovic');
    
    // Click "Aplicar Filtros"
    await page.locator('button', { hasText: 'Aplicar Filtros' }).click();

    // Click "Limpiar Filtros"
    await page.locator('button', { hasText: 'Limpiar Filtros' }).click();
  });

  test('5. Abrir y navegar por las pestañas del Modal de Detalle de Producto', async ({ page }) => {
    await page.getByRole('button', { name: 'Productos', exact: true }).click();

    // Click on product name
    await page.locator('button', { hasText: 'Escape Akrapovic Slip-On Titanium' }).click();

    // Modal title should appear
    await expect(page.locator('text=Detalle de Producto')).toBeVisible();

    // Check Ventas tab stats
    await expect(page.locator('text=Total unidades vendidas')).toBeVisible();
    await expect(page.locator('text=Ingresos totales')).toBeVisible();

    // Switch to 'Detalles' tab
    await page.locator('button', { hasText: 'Detalles' }).click();
    await expect(page.locator('text=Descripción')).toBeVisible();

    // Switch to 'Compatibilidad' tab
    await page.locator('button', { hasText: 'Compatibilidad' }).click();
    await expect(page.locator('div.fixed td', { hasText: 'Yamaha' })).toBeVisible();

    // Close modal
    await page.locator('button[aria-label="Cerrar"]').click();
    await expect(page.locator('text=Detalle de Producto')).toBeHidden();
  });

  test('6. Formulario de Creación de Producto (Producto Simple y Variable)', async ({ page }) => {
    await page.getByRole('button', { name: 'Productos', exact: true }).click();

    // Click "+ Añadir Producto"
    await page.locator('button', { hasText: 'Añadir Producto' }).click();

    // Check form title
    await expect(page.locator('h3', { hasText: 'Nuevo Producto' })).toBeVisible();

    // Fill basic fields
    await page.locator('input[placeholder*="Escape Yoshimura"]').fill('Nuevo Escape de Prueba');
    await page.locator('input[placeholder*="ESC-YOSH"]').fill('TEST-SKU-999');
    await page.locator('input[placeholder="0.00"]').first().fill('499.99');

    // Change type to Variable
    await page.locator('label', { hasText: 'Producto Variable' }).click();
    await expect(page.locator('h4', { hasText: 'Variaciones' })).toBeVisible();

    // Add a variation
    await page.locator('button', { hasText: '+ Añadir Variación' }).click();

    // Switch back to Simple
    await page.locator('label', { hasText: 'Producto Simple' }).click();

    // Close form modal
    await page.locator('button', { hasText: 'Cancelar' }).click();
    await expect(page.locator('h3', { hasText: 'Nuevo Producto' })).toBeHidden();
  });

  test('7. Sub-pestaña Gestor de Atributos Globales', async ({ page }) => {
    await page.getByRole('button', { name: 'Productos', exact: true }).click();

    // Click subtab "Atributos (Tallas/Colores)"
    await page.locator('button', { hasText: 'Atributos (Tallas/Colores)' }).click();

    await expect(page.locator('h3', { hasText: 'Gestor de Atributos Globales' })).toBeVisible();
    await expect(page.getByText('Talla', { exact: true })).toBeVisible();
    await expect(page.getByText('Color', { exact: true })).toBeVisible();

    // Click "+ Añadir Término" on Talla
    const addTermBtns = page.locator('button', { hasText: '+ Añadir Término' });
    await addTermBtns.first().click();

    await expect(page.locator('input[placeholder*="Nuevo término"]')).toBeVisible();
  });

  test('8. Sub-pestaña Taxonomías (Categorías/Motos)', async ({ page }) => {
    await page.getByRole('button', { name: 'Productos', exact: true }).click();

    // Click subtab "Taxonomías (Categorías/Motos)"
    await page.locator('button', { hasText: 'Taxonomías (Categorías/Motos)' }).click();

    // Verify subtab rendered
    await expect(page.locator('button', { hasText: 'Catálogo General' })).toBeVisible();
  });
});
