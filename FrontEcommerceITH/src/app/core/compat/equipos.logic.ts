import { Equipo, Marca } from '../catalog/catalog.models';
import { compactar, palabras } from '../search/normalize';

export const MAX_RESULTADOS_EQUIPOS = 8;

export const nombreDeEquipo = (e: Equipo, marcas: readonly Marca[]) => `${marcas.find((m) => m.id === e.marca_id)?.nombre ?? ''} ${e.modelo}`.trim();

export const marcasConEquipos = (equipos: readonly Equipo[], marcas: readonly Marca[]): Marca[] =>
  marcas.filter((m) => equipos.some((e) => e.marca_id === m.id)).sort((a, b) => a.nombre.localeCompare(b.nombre));

export const equiposDe = (equipos: readonly Equipo[], marcaId: number): Equipo[] =>
  equipos.filter((e) => e.marca_id === marcaId).sort((a, b) => a.modelo.localeCompare(b.modelo));

/**
 * Busca por modelo o código sin importar mayúsculas, espacios ni guiones (CA-1.2, H7): "15itl6", "82H8", "ideapad 3", "Lenovo IdeaPad-3".
 * Coincide si el texto compactado está en el modelo o el código compactados, o si todas las palabras están en "marca + modelo".
 * Los códigos exactos van primero.
 */
export function buscarEquipos(texto: string, equipos: readonly Equipo[], marcas: readonly Marca[]): Equipo[] {
  const compacto = compactar(texto);
  const ps = palabras(texto);
  if (!compacto) return [];

  const puntaje = (e: Equipo): number => {
    const codigo = e.codigo_modelo ? compactar(e.codigo_modelo) : '';
    const completo = compactar(nombreDeEquipo(e, marcas));
    if (codigo && codigo === compacto) return 3;
    if (compactar(e.modelo) === compacto || completo === compacto) return 2;
    if (completo.includes(compacto) || (codigo && codigo.includes(compacto))) return 1;
    const palabrasDelEquipo = palabras(`${nombreDeEquipo(e, marcas)} ${e.codigo_modelo ?? ''}`);
    return ps.every((p) => palabrasDelEquipo.some((w) => w.startsWith(p))) ? 1 : 0;
  };

  return equipos
    .map((e) => ({ e, p: puntaje(e) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || a.e.modelo.localeCompare(b.e.modelo))
    .slice(0, MAX_RESULTADOS_EQUIPOS)
    .map((x) => x.e);
}
