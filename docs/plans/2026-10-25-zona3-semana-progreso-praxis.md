# Plan · Zona 3 (Semana, Progreso y Praxis)

1. **Pruebas primero** (en rojo):
   - `domain/semana/resumen.test.ts` (rango y cuenta de la semana).
   - `features/semana/SemanaPage.test.tsx` (la bandeja y lo conservado).
   - `features/hoy/HoyPage.checkin.test.tsx` (check-in en línea).
   - `features/progreso/ProgresoPage.test.tsx` (historial, medidas, logros, fatiga).
   - `domain/praxis/tarjetas.test.ts` y `features/praxis/TarjetasPraxis.test.tsx`.
   - `BottomNav.test.tsx`, `router.test.tsx` y `rutas.acceso.test.tsx` ajustados.
2. **Dominio**: `src/domain/semana/resumen.ts` y `src/domain/praxis/tarjetas.ts`.
3. **Semana**: `src/features/semana/SemanaPage.tsx`, ruta, barra y título.
4. **Hoy**: `ChequeoDeHoy` en línea para el asesorado; el enlace a `/bienestar` se cambia
   por el historial de Progreso.
5. **Progreso**: `MedidasCard`, `HistorialDeCheckins`, logros y `MapaFatiga`.
6. **Praxis**: `TarjetasPraxis` sobre el cosmos, evento del motor `praxis:frasa`,
   `praxis:quieta`, CSS en `tokens.css`.
7. `npx tsc --noEmit`, `npm run verify`, `npm run build`; commit por paso y PR en borrador.
