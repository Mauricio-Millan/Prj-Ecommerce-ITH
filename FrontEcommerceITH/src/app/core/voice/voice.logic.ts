import { normalizar } from '../search/normalize';

export type AccionVoz = 'volver' | 'cerrar' | 'subir' | 'bajar' | 'accesibilidad' | 'mi-equipo' | 'ayuda-voz' | 'agregar';
export type PreferenciaVoz =
  | { clave: 'tema'; valor: 'claro' | 'oscuro' }
  | { clave: 'contraste'; valor: 'normal' | 'alto' }
  | { clave: 'texto'; valor: 'normal' | 'grande' | 'muy-grande' }
  | { clave: 'espaciado'; valor: 'normal' | 'ampliado' }
  | { clave: 'colores'; valor: 'normal' | 'seguros' }
  | { clave: 'movimiento'; valor: 'reducido' | 'sistema' };

export type ComandoVoz =
  | { tipo: 'ir'; ruta: string; destino: string }
  | { tipo: 'buscar'; q: string }
  | ({ tipo: 'preferencia'; id: string } & PreferenciaVoz)
  | { tipo: 'accion'; accion: AccionVoz }
  /** Acciones que NO se hacen por voz (pagar, confirmar): una frase mal reconocida no puede gastar dinero (spec 020, CA-2.4). */
  | { tipo: 'bloqueado' }
  | { tipo: 'desconocido' };

const VERBOS = /^(ir al?|ve al?|vamos al?|abrir|abre|ver|ve|muestrame|muestra|llevame a|go to|open|show me|show)\s+/;
const ARTICULOS = /^(el|la|los|las|mi|mis|my|the)\s+/;

const RUTAS: { destino: string; ruta: string; frases: string[] }[] = [
  { destino: 'inicio', ruta: '/', frases: ['inicio', 'home', 'pagina principal', 'pagina de inicio', 'tienda'] },
  { destino: 'carrito', ruta: '/carrito', frases: ['carrito', 'carrito de compras', 'cart', 'shopping cart'] },
  { destino: 'ayuda', ruta: '/ayuda', frases: ['ayuda', 'contacto', 'ayuda y contacto', 'help'] },
  { destino: 'armador', ruta: '/armador', frases: ['armar pc', 'arma tu pc', 'armador', 'armador de pc', 'arma pc', 'build a pc', 'pc builder'] },
  { destino: 'pedidos', ruta: '/cuenta/pedidos', frases: ['pedidos', 'pedido', 'mis pedidos', 'orders', 'my orders'] },
  { destino: 'declaracion', ruta: '/accesibilidad', frases: ['declaracion de accesibilidad', 'accessibility statement'] },
];

const ACCIONES: { accion: AccionVoz; frases: string[] }[] = [
  { accion: 'ayuda-voz', frases: ['ayuda de voz', 'ayuda por voz', 'comandos', 'comandos de voz', 'que puedo decir', 'voice help', 'what can i say', 'commands'] },
  { accion: 'volver', frases: ['volver', 'atras', 'regresar', 'pagina anterior', 'go back', 'back'] },
  { accion: 'cerrar', frases: ['cerrar', 'cerrar ventana', 'cerrar dialogo', 'cierra', 'close', 'close window'] },
  { accion: 'subir', frases: ['subir', 'arriba', 'sube', 'desplazar arriba', 'scroll up', 'up'] },
  { accion: 'bajar', frases: ['bajar', 'abajo', 'baja', 'desplazar abajo', 'scroll down', 'down'] },
  { accion: 'accesibilidad', frases: ['accesibilidad', 'preferencias de accesibilidad', 'ajustes de accesibilidad', 'accessibility', 'accessibility settings'] },
  { accion: 'mi-equipo', frases: ['mi equipo', 'elegir mi equipo', 'indicar mi equipo', 'seleccionar mi equipo', 'my device', 'my laptop'] },
  { accion: 'agregar', frases: ['agregar al carrito', 'anadir al carrito', 'agrega al carrito', 'agregar', 'add to cart', 'add to the cart'] },
];

const PREFERENCIAS: { id: string; frases: string[]; pref: PreferenciaVoz }[] = [
  { id: 'tema-oscuro', frases: ['modo oscuro', 'tema oscuro', 'activar modo oscuro', 'dark mode', 'dark theme'], pref: { clave: 'tema', valor: 'oscuro' } },
  { id: 'tema-claro', frases: ['modo claro', 'tema claro', 'activar modo claro', 'light mode', 'light theme'], pref: { clave: 'tema', valor: 'claro' } },
  { id: 'contraste-alto', frases: ['alto contraste', 'activar alto contraste', 'contraste alto', 'high contrast'], pref: { clave: 'contraste', valor: 'alto' } },
  { id: 'contraste-normal', frases: ['contraste normal', 'quitar alto contraste', 'normal contrast'], pref: { clave: 'contraste', valor: 'normal' } },
  { id: 'colores-seguros', frases: ['modo daltonico', 'colores para daltonismo', 'colores seguros', 'modo para daltonicos', 'color blind mode', 'color blind colors'], pref: { clave: 'colores', valor: 'seguros' } },
  { id: 'colores-normales', frases: ['colores normales', 'quitar modo daltonico', 'normal colors'], pref: { clave: 'colores', valor: 'normal' } },
  { id: 'texto-grande', frases: ['texto grande', 'letra grande', 'agrandar texto', 'large text', 'bigger text'], pref: { clave: 'texto', valor: 'grande' } },
  { id: 'texto-muy-grande', frases: ['texto muy grande', 'letra muy grande', 'extra large text'], pref: { clave: 'texto', valor: 'muy-grande' } },
  { id: 'texto-normal', frases: ['texto normal', 'letra normal', 'tamano normal', 'normal text'], pref: { clave: 'texto', valor: 'normal' } },
  { id: 'espaciado-ampliado', frases: ['mas espacio', 'espaciado ampliado', 'ampliar espaciado', 'more spacing'], pref: { clave: 'espaciado', valor: 'ampliado' } },
  { id: 'movimiento-reducido', frases: ['reducir movimiento', 'sin animaciones', 'reduce motion'], pref: { clave: 'movimiento', valor: 'reducido' } },
];

const BLOQUEADOS = /\b(pagar|pago|paga|confirmar pedido|confirma el pedido|finalizar compra|comprar ahora|pay|checkout|place order)\b/;
const BUSCAR = /^(buscar|busca|buscame|quiero buscar|search for|search|find)\s+(.+)$/i;

/**
 * Interpreta lo que dijo la persona (spec 020, HU-1 y HU-2). Función pura y por frases cerradas: no hay "adivinanza", un comando
 * es lo que dice la lista o no es nada, y entonces se pide repetir (H9). Las frases están en español e inglés.
 */
export function interpretarComando(dicho: string): ComandoVoz {
  const original = dicho.trim();
  const t = normalizar(original);
  if (!t) return { tipo: 'desconocido' };

  // "buscar X": lo que sigue se busca tal cual lo oyó el reconocedor.
  const b = BUSCAR.exec(original.replace(/[.,;:!?¿¡]+$/g, ''));
  if (b) return b[2].trim() ? { tipo: 'buscar', q: b[2].trim() } : { tipo: 'desconocido' };

  if (BLOQUEADOS.test(t)) return { tipo: 'bloqueado' };

  const sinVerbo = t.replace(VERBOS, '').replace(ARTICULOS, '').trim();
  const es = (frases: string[]) => frases.includes(t) || frases.includes(sinVerbo);

  for (const p of PREFERENCIAS) if (es(p.frases)) return { tipo: 'preferencia', id: p.id, ...p.pref };
  for (const a of ACCIONES) if (es(a.frases)) return { tipo: 'accion', accion: a.accion };
  for (const r of RUTAS) if (es(r.frases)) return { tipo: 'ir', ruta: r.ruta, destino: r.destino };
  return { tipo: 'desconocido' };
}

