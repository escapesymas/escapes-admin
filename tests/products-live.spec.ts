import { test, expect } from '@playwright/test';

test.describe('Pruebas Live contra Servidor Real (localhost:5174)', () => {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  test('Auditoría del Módulo de Productos en vivo sin mocks', async ({ page }) => {
    // Escuchar errores de consola y red
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('response', response => {
      if (response.status() >= 400 && response.url().includes('/api/admin')) {
        networkErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    // Inyectar sesión de administrador simulada en localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('escapesymas_admin_session', JSON.stringify({
        token: 'test-token',
        user_id: '1',
        user_email: 'admin@escapesymas.com'
      }));
    });

    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');

    // Navegar a la pestaña Productos
    const productsBtn = page.getByRole('button', { name: 'Productos', exact: true });
    await expect(productsBtn).toBeVisible();
    await productsBtn.click();

    // Esperar a que la tabla o mensaje de carga responda
    await page.waitForTimeout(1000);

    // Verificar que la interfaz del catálogo renderiza sin fallos en el DOM
    await expect(page.locator('h1')).toContainText('Catálogo de Productos');

    // Verificar subpestañas (Catálogo General, Atributos, Taxonomías)
    await page.locator('button', { hasText: 'Atributos (Tallas/Colores)' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('h3', { hasText: 'Gestor de Atributos Globales' })).toBeVisible();

    await page.locator('button', { hasText: 'Taxonomías (Categorías/Motos)' }).click();
    await page.waitForTimeout(500);

    await page.locator('button', { hasText: 'Catálogo General' }).click();
    await page.waitForTimeout(500);

    // Imprimir reporte de consola y red
    console.log('--- REPORTE DE RED Y ERRORES ---');
    console.log('Errores de consola:', consoleErrors);
    console.log('Peticiones API fallidas (4xx/5xx):', networkErrors);
  });
});
