-- ============================================================================
-- 0078 · La app cuenta lo que le falla
-- ============================================================================
--
-- Decisión de Bryan del 2026-09-13. Del 10 al 12 de septiembre el cuestionario de salud falló
-- para todo el mundo: `contestar_cribado()` devolvía 42883, PostgREST lo convertía en 404, la
-- cola lo reintentaba y lo apartaba en silencio. 37 llamadas fallidas y nadie se enteró hasta
-- que Bryan oyó las quejas. La app se traga muchos errores a propósito (una red de gimnasio no
-- puede tumbar un entreno), y por eso mismo necesita un sitio donde dejarlos escritos.
--
-- Esta tabla es ese sitio. La escribe `src/data/errores/reportarError.ts` desde el navegador de
-- cada persona, directo y sin pasar por la cola de sincronización (el porqué está en ese
-- archivo). La lee el panel del coach (`src/features/coach/ErroresDelNavegador.tsx`).
--
-- SEGURIDAD:
--   · Una persona autenticada solo INSERTA filas a su nombre. `usuario_id` sale por defecto de
--     `auth.uid()` y la política exige que coincida: no se puede ensuciar el registro de otro.
--   · Solo el COACH lee (`es_coach()`, la de la 0001). Ni la nutricionista ni el propio
--     asesorado: un mensaje de error puede traer trozos de datos, y a quien le falló no le
--     sirve de nada releerlo.
--   · Nadie actualiza ni borra por la API: sin política y sin privilegio. Un registro de
--     fallos que el cliente puede reescribir no prueba nada.
--   · `anon` no tiene nada: sin sesión no hay a quién atribuir el error.
--   · Los textos van acotados TAMBIÉN aquí, no solo en el cliente. El cliente ya trunca, pero
--     un cliente viejo o manipulado no debe poder meter megas por fila.
-- ============================================================================

begin;

create table if not exists public.errores_navegador (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null default auth.uid()
              references public.usuarios_app(id) on delete cascade,
  creado_en   timestamptz not null default now(),
  -- Solo la ruta (`location.pathname`): sin query ni hash, que es donde viajan los tokens de
  -- recuperación de clave.
  pantalla    text check (char_length(pantalla) <= 200),
  mensaje     text not null check (char_length(mensaje) between 1 and 500),
  pila        text check (char_length(pila) <= 4000),
  origen      text not null check (origen in ('window.error', 'unhandledrejection', 'reportado')),
  -- Dónde se tragó el fallo quien lo reporta a mano (`hidratar:refresco`, `cola:<tabla>`…).
  donde       text check (char_length(donde) <= 100),
  user_agent  text check (char_length(user_agent) <= 300),
  -- El sha del build (Vercel lo da como VERCEL_GIT_COMMIT_SHA). Dice si un fallo es de un
  -- despliegue viejo que sigue abierto en algún teléfono.
  version     text check (char_length(version) <= 64)
);

comment on table public.errores_navegador is
  'Errores del navegador de las personas que usan la app (Bryan, 2026-09-13). '
  'Cada una inserta solo a su nombre; solo el coach lee; nadie actualiza ni borra por la API.';

-- El panel pregunta por los últimos 7 días, ordenado por fecha.
create index if not exists errores_navegador_por_fecha
  on public.errores_navegador (creado_en desc);

alter table public.errores_navegador enable row level security;

create policy errores_navegador_cada_uno_escribe_lo_suyo on public.errores_navegador
  for insert to authenticated with check (usuario_id = (select auth.uid()));

create policy errores_navegador_lee_el_coach on public.errores_navegador
  for select to authenticated using ((select public.es_coach()));

-- Sin políticas de update ni delete, y además sin el privilegio: que no dependa de que nadie
-- añada después una política `for all` sin pensar en esta tabla.
revoke all on public.errores_navegador from anon, public;
revoke update, delete, truncate on public.errores_navegador from authenticated;
grant select, insert on public.errores_navegador to authenticated;

commit;
