# E-commerce ITH — Monorepo

Proyecto del curso **Interacción Hombre-Máquina** desarrollado con **Spec Driven Development**.

```
├── specs/                 # Fuente de verdad (SDD)
│   ├── constitution.md    # Reglas no negociables — leer primero
│   ├── producto.md        # Visión, dominio, taxonomía, usuarios, mapa de features
│   ├── modelo-datos.md    # Diagrama entidad-relación (Mermaid) y decisiones de datos
│   ├── entregables/       # Requerimientos del curso (APF1–PROY) y cómo se responden
│   ├── _templates/        # spec.md · plan.md · tasks.md
│   └── NNN-feature/       # Una carpeta por feature
├── FrontEcommerceITH/     # Angular 20 (SSR) — arquitectura por layouts
│   └── src/app/{core, shared/ui, layouts, pages}
├── BackEcommerceITH/      # FastAPI — arquitectura en capas
│   └── app/{core, api/v1/routes, schemas, services, repositories}
├── supabase/migrations/   # Esquema de BD + RLS
└── Docs/                  # Material del curso y reglas UX (Nielsen)
```

## Flujo para un feature nuevo

1. Copiar `specs/_templates/*` a `specs/NNN-feature/`.
2. Escribir `spec.md` → aprobar → `plan.md` → `tasks.md`.
3. Implementar: migración en `supabase/` → backend por capas (repository → service → route) → página en `FrontEcommerceITH/src/app/pages/<feature>/` dentro de su layout.
4. Verificar contra la spec y la Definición de Hecho de la [constitución](specs/constitution.md).

## Ejecutar

**Frontend**
```bash
cd FrontEcommerceITH
npm install
npm start            # http://localhost:4200
```

**Backend**
```bash
cd BackEcommerceITH
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -e ".[dev]"
cp .env.example .env                              # completar credenciales
fastapi dev app/main.py                           # http://localhost:8000/docs
```

**Supabase** (requiere [Supabase CLI](https://supabase.com/docs/guides/local-development))
```bash
supabase init        # una sola vez: crea supabase/config.toml
supabase link --project-ref <ref>
supabase db push     # aplica supabase/migrations/
```
