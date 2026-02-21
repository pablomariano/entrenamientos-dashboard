# Dashboard de Entrenamientos

Dashboard standalone para visualizar y analizar entrenamientos del Polar RCX5.

## Stack

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui components
- recharts

## Desarrollo

```bash
pnpm install
pnpm dev
```

Abre [http://localhost:3000/entrenamientos](http://localhost:3000/entrenamientos) en el navegador.

## Uso

1. Exporta tus entrenamientos con `python scripts/exportar_para_dashboard.py`
2. Carga el archivo `entrenamientos.json` en la página de inicio
3. Explora el dashboard con estadísticas, gráficos de HR, duración y sesiones

## Rutas

- `/entrenamientos` — Página de carga de archivo
- `/entrenamientos/dashboard` — Dashboard principal
- `/entrenamientos/dashboard/tweakcn` — Dashboard de ejemplo tweakcn
