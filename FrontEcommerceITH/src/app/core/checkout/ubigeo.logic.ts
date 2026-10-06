export interface Ubigeo {
  id: string;
  departamento: string;
  provincia: string;
  distrito: string;
}

const unicos = (valores: string[]) => [...new Set(valores)].sort((a, b) => a.localeCompare(b, 'es'));

export const departamentos = (lista: readonly Ubigeo[]): string[] => unicos(lista.map((u) => u.departamento));

/** Sin departamento elegido → `[]`: los selectores se habilitan en orden (CA-2.2, H5). */
export const provincias = (lista: readonly Ubigeo[], departamento: string): string[] =>
  departamento ? unicos(lista.filter((u) => u.departamento === departamento).map((u) => u.provincia)) : [];

export const distritos = (lista: readonly Ubigeo[], departamento: string, provincia: string): Ubigeo[] =>
  departamento && provincia
    ? lista.filter((u) => u.departamento === departamento && u.provincia === provincia).sort((a, b) => a.distrito.localeCompare(b.distrito, 'es'))
    : [];
