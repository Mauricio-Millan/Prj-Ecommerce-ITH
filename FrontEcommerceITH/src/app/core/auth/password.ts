/**
 * SHA-256 en hexadecimal con Web Crypto. Requiere contexto seguro (https o localhost): `ng serve`, GitHub Pages y Netlify lo cumplen;
 * abrir el build por `file://` o por la IP de la red local con http, no (spec 004, riesgos).
 */
export async function sha256Hex(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
