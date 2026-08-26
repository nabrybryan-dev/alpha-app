-- 0043 · Si la técnica de un ejercicio ya está asentada, y para quién.
--
-- ⚠ NO APLICAR SIN CORRER ANTES `supabase/comprobar-ids-de-ejercicio.sql`.
--    Las cuatro filas tienen que dar OK. La tabla se apoya en que
--    `ejercicio.id` sea único dentro de una persona y persista entre
--    microciclos; lo primero solo lo puede decir la base.
--
-- PARA QUÉ. El método dice «primero se estandariza, después se sobrecarga»: no
-- se progresa sobre una técnica que todavía varía de una semana a otra, porque
-- entonces la subida de carga no es información, es ruido. El agente de
-- planificación necesita saberlo por ejercicio, y hoy no hay dónde mirarlo.
--
-- POR QUÉ DERIVADO Y NO MARCADO A MANO. Son ~20 asesorados × ~25 ejercicios =
-- unas 500 marcas. De 96 sesiones activas, solo 33 traían el campo `dia`: lo que
-- depende de marcar uno por uno, no se marca. Aquí el coach solo VETA.
--
-- POR QUÉ EL DEFECTO ES «no». La dirección del error decide su gravedad. Marcar
-- de más significa progresar sobre técnica inestable —descontrol al iniciar la
-- concéntrica, ayuda de cadera, codo desalineado— y ese fue el punto de partida
-- del caso que costó un bloque entero. Marcar de menos cuesta una semana.
--
-- Diseño completo:
--   Cerebro Alpha/docs/superpowers/specs/2026-08-25-atributos-por-ejercicio.md §4

create table if not exists public.estandarizado_ejercicio (
  usuario_id     uuid        not null references public.usuarios_app(id) on delete cascade,
  -- `EjercicioPrescrito.id`, tal cual vive dentro de `microciclos.datos`. Es
  -- text y no uuid a propósito: el id lo escribe la app y no hay garantía de
  -- formato en lo ya cargado.
  ejercicio_id   text        not null,
  estado         text        not null default 'no' check (estado in ('si','no')),
  -- 'derivado' lo recalcula la carga; 'veto_coach' lo CONGELA. El veto gana
  -- siempre, que es la regla del método y no una preferencia de implementación.
  origen         text        not null default 'derivado' check (origen in ('derivado','veto_coach')),
  -- Racha de microciclos limpios. Tres lo activan. Se guarda el contador y no
  -- solo el booleano para poder auditar por qué algo está o no está, y para que
  -- una racha rota se vea en vez de deducirse.
  microciclos_ok int         not null default 0 check (microciclos_ok >= 0),
  -- Qué rompió la racha la última vez. Texto libre corto: 'nota tecnica nueva',
  -- 'rir fuera de banda', 'ejercicio nuevo'. Para leer el historial sin
  -- reconstruirlo.
  motivo         text,
  actualizado_en timestamptz not null default now(),
  primary key (usuario_id, ejercicio_id)
);

comment on table public.estandarizado_ejercicio is
  'Si la técnica de un ejercicio ya está asentada para esa persona. Derivado de '
  '3 microciclos sin nota técnica nueva y con |RIR real − objetivo| <= 1. El veto '
  'del coach congela el valor. Gobierna si el planificador puede subir carga.';

comment on column public.estandarizado_ejercicio.origen is
  'derivado = lo recalcula la carga. veto_coach = congelado, la derivación no lo pisa.';

-- El planificador pregunta «qué ejercicios de esta persona están estandarizados»,
-- que ya sirve la clave primaria. Este índice es para la consulta inversa —el
-- barrido de cuántos vetos hay puestos— que si no obliga a leer la tabla entera.
create index if not exists estandarizado_ejercicio_veto_idx
  on public.estandarizado_ejercicio (origen)
  where origen = 'veto_coach';

alter table public.estandarizado_ejercicio enable row level security;

-- El asesorado puede LEER lo suyo: la app le enseña por qué un ejercicio todavía
-- no sube carga, y esconderlo no aporta nada. Escribir, no: lo escribe la carga
-- con la service role, y el veto lo pone el coach.
drop policy if exists estandarizado_lee_lo_suyo on public.estandarizado_ejercicio;
create policy estandarizado_lee_lo_suyo
  on public.estandarizado_ejercicio for select
  using (usuario_id = auth.uid());
