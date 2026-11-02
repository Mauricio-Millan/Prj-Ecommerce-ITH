import { interpretarComando } from './voice.logic';

describe('interpretarComando (spec 020)', () => {
  it('CA-1.2: "buscar X" busca lo que sigue, con o sin tildes y mayúsculas', () => {
    expect(interpretarComando('Buscar batería Lenovo L19M3PF4')).toEqual({ tipo: 'buscar', q: 'batería Lenovo L19M3PF4' });
    expect(interpretarComando('busca memoria RAM para mi lenovo.')).toEqual({ tipo: 'buscar', q: 'memoria RAM para mi lenovo' });
    expect(interpretarComando('search for mouse')).toEqual({ tipo: 'buscar', q: 'mouse' });
    expect(interpretarComando('buscar').tipo).toBe('desconocido'); // sin nada que buscar
  });

  it('CA-1.3: navegación por frases cerradas, con verbos y artículos opcionales', () => {
    for (const f of ['carrito', 'ir al carrito', 'abrir el carrito', 'ir a carrito', 'Ver el carrito de compras', 'open the cart']) {
      expect(interpretarComando(f)).toEqual({ tipo: 'ir', ruta: '/carrito', destino: 'carrito' });
    }
    expect(interpretarComando('ir a inicio')).toEqual({ tipo: 'ir', ruta: '/', destino: 'inicio' });
    expect(interpretarComando('armar PC')).toEqual({ tipo: 'ir', ruta: '/armador', destino: 'armador' });
    expect(interpretarComando('mis pedidos')).toEqual({ tipo: 'ir', ruta: '/cuenta/pedidos', destino: 'pedidos' });
    expect(interpretarComando('declaración de accesibilidad')).toEqual({ tipo: 'ir', ruta: '/accesibilidad', destino: 'declaracion' });
  });

  it('CA-1.4: "ayuda" lleva a la página; "ayuda de voz" abre la lista de comandos', () => {
    expect(interpretarComando('ayuda')).toEqual({ tipo: 'ir', ruta: '/ayuda', destino: 'ayuda' });
    expect(interpretarComando('ayuda de voz')).toEqual({ tipo: 'accion', accion: 'ayuda-voz' });
    expect(interpretarComando('¿Qué puedo decir?')).toEqual({ tipo: 'accion', accion: 'ayuda-voz' });
  });

  it('HU-3: preferencias de accesibilidad por voz (tema, contraste, colores, texto)', () => {
    expect(interpretarComando('modo oscuro')).toEqual(jasmine.objectContaining({ tipo: 'preferencia', clave: 'tema', valor: 'oscuro' }));
    expect(interpretarComando('activar alto contraste')).toEqual(jasmine.objectContaining({ clave: 'contraste', valor: 'alto' }));
    expect(interpretarComando('modo daltónico')).toEqual(jasmine.objectContaining({ clave: 'colores', valor: 'seguros' }));
    expect(interpretarComando('colores normales')).toEqual(jasmine.objectContaining({ clave: 'colores', valor: 'normal' }));
    expect(interpretarComando('texto muy grande')).toEqual(jasmine.objectContaining({ clave: 'texto', valor: 'muy-grande' }));
    expect(interpretarComando('texto grande')).toEqual(jasmine.objectContaining({ clave: 'texto', valor: 'grande' }));
  });

  it('acciones: volver, cerrar, desplazar, abrir el panel, mi equipo y agregar al carrito', () => {
    const a = (f: string) => interpretarComando(f);
    expect(a('volver')).toEqual({ tipo: 'accion', accion: 'volver' });
    expect(a('cerrar')).toEqual({ tipo: 'accion', accion: 'cerrar' });
    expect(a('bajar')).toEqual({ tipo: 'accion', accion: 'bajar' });
    expect(a('abrir accesibilidad')).toEqual({ tipo: 'accion', accion: 'accesibilidad' });
    expect(a('mi equipo')).toEqual({ tipo: 'accion', accion: 'mi-equipo' });
    expect(a('agregar al carrito')).toEqual({ tipo: 'accion', accion: 'agregar' });
  });

  it('CA-2.4: pagar o confirmar un pedido NUNCA se ejecuta por voz', () => {
    for (const f of ['pagar', 'quiero pagar ahora', 'confirmar pedido', 'finalizar compra', 'pay now']) expect(interpretarComando(f).tipo).withContext(f).toBe('bloqueado');
  });

  it('CA-1.5: lo que no es un comando no hace nada', () => {
    for (const f of ['', '   ', 'hola qué tal', 'asdf']) expect(interpretarComando(f).tipo).withContext(f).toBe('desconocido');
  });
});
