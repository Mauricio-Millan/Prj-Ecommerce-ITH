/**
 * Un lector de código de barras USB o Bluetooth es, para el navegador, un teclado muy rápido que termina con Enter (spec 014, HU-2).
 * No hay una API que lo distinga: se reconoce por la velocidad entre teclas y por un largo mínimo.
 * Las dos constantes se calibran con el lector real del equipo (un lector Bluetooth puede ser más lento) — plan § 4.
 */
export const MAX_MS_ENTRE_TECLAS = 50;
export const MIN_CARACTERES_LECTURA = 6;
/** Una pausa mayor que esta entre dos teclas descarta lo acumulado: lo que se escribe a mano nunca llega a ser lectura. */
const PAUSA_QUE_REINICIA_MS = 120;

export class DetectorLector {
  private buffer = '';
  private ultima = 0;
  private sumaIntervalos = 0;

  /** Alimentar con cada `keydown` (`key` y `timeStamp`). Devuelve el código cuando la ráfaga termina en Enter y parece de un lector. */
  tecla(key: string, ahora: number): string | null {
    if (key === 'Enter') {
      const n = this.buffer.length;
      const media = n > 1 ? this.sumaIntervalos / (n - 1) : Infinity;
      const codigo = this.buffer;
      this.reiniciar();
      return n >= MIN_CARACTERES_LECTURA && media <= MAX_MS_ENTRE_TECLAS ? codigo : null;
    }
    if (key.length !== 1) return null; // Shift, flechas, etc. no interrumpen ni cuentan
    if (this.buffer && ahora - this.ultima > PAUSA_QUE_REINICIA_MS) this.reiniciar();
    if (this.buffer) this.sumaIntervalos += ahora - this.ultima;
    this.buffer += key;
    this.ultima = ahora;
    return null;
  }

  reiniciar(): void {
    this.buffer = '';
    this.sumaIntervalos = 0;
  }
}
