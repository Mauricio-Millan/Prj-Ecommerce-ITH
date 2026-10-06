import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { localStore } from '../storage/local-store';
import { InteractionLogger, claveEventos, patronDeRuta } from './interaction-logger';

describe('InteractionLogger', () => {
  let logger: InteractionLogger;
  const SESION = 'P99-v1';
  const nodos: Element[] = [];
  const agregar = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
    nodos.push(div);
    return div;
  };
  const clics = () => logger.eventos().filter((e) => e.e === 'click').length;

  beforeEach(() => {
    jasmine.clock().install();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([{ path: 'producto/:id', children: [] }])],
    });
    logger = TestBed.inject(InteractionLogger);
  });

  afterEach(() => {
    logger.stop();
    jasmine.clock().uninstall();
    localStore.remove(claveEventos(SESION));
    nodos.splice(0).forEach((n) => n.remove());
  });

  it('sin sesión no registra nada (CA-2.8)', () => {
    logger.track('search', { resultados: 0 });
    document.body.click();
    expect(logger.eventos().length).toBe(0);
  });

  it('un clic dentro del panel se descarta (CA-1.7)', () => {
    logger.start(SESION, 'v1');
    agregar('<div data-research-panel><button>x</button></div>').querySelector('button')!.click();
    expect(clics()).toBe(0);
    document.body.click();
    expect(clics()).toBe(1);
  });

  it('100 track() → 0 escrituras inmediatas y 1 en el siguiente flush (T021)', () => {
    logger.start(SESION, 'v1');
    const set = spyOn(localStore, 'set').and.callThrough();
    for (let i = 0; i < 100; i++) logger.track('search');
    expect(set).not.toHaveBeenCalled();
    jasmine.clock().tick(2000);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('50 mousemove en 100 ms → como máximo 1 evento (CA-2.2)', () => {
    logger.start(SESION, 'v1');
    for (let i = 0; i < 50; i++) document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: i, clientY: i }));
    jasmine.clock().tick(100);
    expect(logger.eventos().filter((e) => e.e === 'mouse_move').length).toBe(1);
  });

  it('stop() quita los listeners', () => {
    logger.start(SESION, 'v1');
    logger.stop();
    document.body.click();
    expect(clics()).toBe(0);
  });

  it('contexto: centro de una zona ≈ 0.5, sticky = fijo con coordenadas de ventana, modal abierto (CA-2.10–2.12)', () => {
    logger.start(SESION, 'v1');
    const raiz = agregar(`
      <header style="position: sticky; top: 0; height: 50px"><span id="en-header">h</span></header>
      <div data-zone="precio" style="position: absolute; left: 100px; top: 100px; width: 200px; height: 100px"></div>
      <div data-modal="mi-equipo"></div>`);
    const zona = raiz.querySelector('[data-zone]')!;
    const r = zona.getBoundingClientRect();
    const ctx = logger.contexto(zona, r.left + r.width / 2, r.top + r.height / 2, 0, 0, true);
    expect(ctx.z).toBe('precio');
    expect(ctx.zx).toBeCloseTo(0.5, 2);
    expect(ctx.zy).toBeCloseTo(0.5, 2);
    expect(ctx.m).toBe('mi-equipo');

    const fijo = logger.contexto(raiz.querySelector('#en-header')!, 10, 20, 10, 2020, true);
    expect(fijo.f).toBe(1);
    expect(fijo.y).toBe(20);
  });

  it('patrón de ruta: /producto/123 → /producto/:id (CA-2.13)', async () => {
    jasmine.clock().uninstall();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/producto/123');
    expect(patronDeRuta(router.routerState.snapshot.root)).toBe('/producto/:id');
    jasmine.clock().install();
  });
});
