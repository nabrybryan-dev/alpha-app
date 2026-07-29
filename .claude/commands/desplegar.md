---
description: Checklist de despliegue seguro (un push a main publica en producción)
---

Desplegar la app Alpha Athletics. **Un push a `main` publica en producción para
asesorados reales**, así que recorre este checklist en orden y **detente** en cuanto
algo falle: no sigas «arreglando por el camino».

1. **Rama.** Confirma que el trabajo no está en `main`. Si lo está, créale rama
   antes de nada.
2. **Gate.** Corre `npm run verify` (tipos + linter + tests). Tiene que salir en
   verde. Si hay tests en rojo, para y diagnostica; no los ajustes para que pasen.
3. **Avisos.** Comprueba que no aumentó el número de avisos del linter respecto a la
   base documentada en `CLAUDE.md`. Un aviso nuevo es deuda que se cuela.
4. **Aislamiento.** Si el cambio toca `SessionProvider`, `data/nube/` o
   `data/repos.ts`, verifica explícitamente que siguen verdes
   `SessionProvider.aislamiento.test.tsx` y `data/nube/perdida-datos.test.ts`. Son
   la propiedad más importante de la app y ya se rompió dos veces.
5. **Migraciones.** Si hay SQL nuevo en `supabase/migrations/`:
   - el número es el siguiente de la serie y **no se editó ninguna ya aplicada**;
   - toda tabla o columna nueva tiene su política RLS, y la política **no es
     tautológica** (`rol = rol` permitió auto-promoverse a coach: ver `0008`);
   - la migración se aplica **antes** de que el código que la necesita llegue a
     producción, nunca después.
6. **Secretos.** Revisa el diff: ni claves, ni `.env.local`, ni `CLAVES.local.txt`,
   ni `*.local.sql`, ni datos personales de asesorados.
7. **Resumen antes de empujar.** Dile a Bryan qué se va a publicar, qué se verificó
   y qué riesgo queda. **Pide autorización explícita para el push a `main`.**
8. **Después.** Comprueba que el CI quedó verde y que la app carga en producción.
   Si algo se rompió, la vuelta atrás es revertir el commit, no parchear en caliente.

Si aparece un fallo real durante el proceso, archívalo como incidente en el Cerebro
de Programación (`/incidente`) en vez de dejarlo solo en el chat.
