import axe from 'axe-core';

/**
 * Ejecuta axe-core sobre un elemento y devuelve las violaciones críticas o serias (spec 018 CA-7.3).
 * `color-contrast` queda fuera: en las pruebas unitarias no se cargan los estilos reales; el contraste se mide aparte
 * (`specs/018-accesibilidad/herramientas/contraste.mjs` y `temas.mjs`). Un resultado vacío NO prueba que sea accesible:
 * axe detecta solo una parte de los problemas (la revisión manual y con lector de pantalla sigue siendo necesaria).
 */
export async function violacionesGraves(el: HTMLElement): Promise<string[]> {
  const r = await axe.run(el, { rules: { 'color-contrast': { enabled: false } }, resultTypes: ['violations'] });
  return r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}
