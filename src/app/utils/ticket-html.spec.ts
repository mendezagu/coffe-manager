import { buildComanda, buildCuenta, escapeHtml, TicketBrand } from './ticket-html';

describe('ticket-html (plantilla única de comanda y cuenta)', () => {
  const brand: TicketBrand = { name: 'Café Central', logoUrl: null, headerLines: ['CUIT: 30-1'] };
  const date = new Date(2026, 9, 17, 14, 30);

  it('escapa el texto que viene de afuera', () => {
    expect(escapeHtml(`<b>"a" & 'b'</b>`)).toBe('&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;');
    const html = buildComanda({ tableName: '<script>x</script>', lines: [{ name: 'Té', quantity: 1 }] }, brand, { date });
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;x');
  });

  it('la comanda lleva platos, extras y aclaraciones, sin precios', () => {
    const html = buildComanda(
      { tableName: '4', waiterName: 'Lucía', lines: [{ name: 'Café', quantity: 2, modifiers: 'Grande', note: 'bien caliente' }] },
      brand,
      { date }
    );
    expect(html).toContain('CAFÉ CENTRAL');
    expect(html).toContain('Mozo: <strong>Lucía</strong>');
    expect(html).toContain('x2');
    expect(html).toContain('+ Grande');
    expect(html).toContain('- Café: bien caliente');
    expect(html).not.toContain('$');
  });

  it('sin mozo ni aclaraciones usa los valores por defecto', () => {
    const html = buildComanda({ tableName: '4', waiterName: '  ', lines: [{ name: 'Té', quantity: 1 }] }, brand, { date });
    expect(html).toContain('No asignado');
    expect(html).toContain('<p>-</p>');
  });

  it('la cuenta muestra renglones, extras, descuento y resumen', () => {
    const html = buildCuenta(
      {
        tableName: '4',
        waiterName: 'Lucía',
        lines: [
          {
            name: 'Café',
            suffix: '(PROMO)',
            quantity: 2,
            amount: '$ 100',
            mods: [{ text: '+ Leche', amount: '+$ 10' }],
            discount: { text: 'Desc. 10%', amount: '-$ 10' },
          },
        ],
        summary: [
          { label: 'Total:', value: '$ 100', big: true },
          { text: 'Efectivo: $ 100' },
        ],
      },
      brand,
      { date }
    );
    expect(html).toContain('Café (PROMO)');
    expect(html).toContain('+ Leche');
    expect(html).toContain('Desc. 10%');
    expect(html).toContain('<p class="big"><strong>Total:</strong> $ 100</p>');
    expect(html).toContain('<p>Efectivo: $ 100</p>');
    expect(html).toContain('CUIT: 30-1');
    expect(html).toContain('Atendido por:</strong> Lucía');
  });

  it('recarga la pantalla de origen solo si se pide', () => {
    const data = { tableName: '4', lines: [{ name: 'Té', quantity: 1 }] };
    expect(buildComanda(data, brand, { date })).not.toContain('opener.location.reload');
    expect(buildComanda(data, brand, { date, reloadOpenerAfterPrint: true })).toContain('opener.location.reload');
  });
});