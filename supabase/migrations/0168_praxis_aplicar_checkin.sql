-- ============================================================================
-- 0168 · Praxis: guardar el check-in que la persona confirmó (por el libro) y el ranking sin check-ins a medias
-- ============================================================================
--
-- SIN APLICAR. Escrita el 7-nov-2026 (paso 4 del diseño docs/specs/2026-11-07-conectores-lenguaje-a-checkin-diseno.md).
-- Aplicarla es decisión de Bryan. La prueba `supabase/test/265-praxis-aplicar-checkin.sql` corre en el CI sobre base
-- vacía. Necesita la 0161 (el libro) aplicada. Nada la llama todavía: la tarjeta del check-in está detrás de
-- `CONECTORES_EN_TARJETA` (apagada) y la Edge Function no tiene aún la rama del check-in.
--
-- NÚMERO. 0168 = el siguiente libre (TRASPASO 7-nov: 0166 y 0167 escritas sin aplicar). Revisadas el 7-nov las
-- migraciones de todas las ramas remotas (`git ls-tree` sobre cada `origin/*`): ninguna tiene 0168. Si otra rama
-- toma el 0168 antes de aplicar esta, renumerar esta.
--
-- QUÉ CREA O CAMBIA.
--   1. `praxis_aplicar_checkin(mensaje_id, indice, parche)`: escribe en el check-in de HOY (Bogotá) solo los campos
--      que la persona tocó en la tarjeta, una vez por tarjeta, y anota en el libro el `antes` de cada campo.
--   2. `ranking_disciplina_vivo()`: se redefine con UNA línea cambiada: un check-in a medias no cuenta.
--      Cuerpo copiado literal de la 0048 (la única que lo define; la 0066 solo lo menciona).
--
-- REGLAS (decisiones de Bryan):
--   · 7-nov: no se crean días futuros. No hay parámetro de fecha: solo HOY en hora de Bogotá.
--   · 7-nov: un check-in a medias NO da puntos hasta completarlo. Si tras el parche falta alguno de los 8
--     obligatorios del formulario (rendimiento, motivacion, hambreEscala, cansancio, estres, dolor, calidadSueno,
--     alimentacion), la fila queda con `datos.parcial = true`; con los 8, la marca se quita.
--   · 5-nov/7-nov: lo que la persona no confirmó no llega aquí (lo filtra la tarjeta). Aquí se revalida igual:
--     solo 9 campos, cada uno en la escala del formulario. El dolor SOLO admite 0 («sin dolor»): cualquier otro
--     dolor lo marca la persona en el formulario (regla de vida.ts). Peso, pasos y comentarios no entran por aquí.
--   · Fusión: `datos || parche`. Lo que la fila ya tenía y el parche no trae se conserva. Si el parche trae
--     `horasSueno`, se añade a `anotadoHoy` (no es el 7 del formulario: lo dijo la persona).
--
-- QUIÉN PUEDE QUÉ (molde de la 0161 y la 0162). `security definer`, `search_path` fijo, NO recibe `usuario_id`:
-- toma `auth.uid()`. Sin sesión se niega. `revoke execute from public, anon`. La RLS de `checkins` deja al coach
-- escribir en la fila de otra persona (0047); esta función no: escribe siempre la fila de quien llama.
--
-- IDEMPOTENCIA. El libro primero por `(usuario_id, mensaje_id, indice)`: la misma tarjeta dos veces no escribe dos
-- veces y devuelve `ya_aplicado = true` con la fila actual. Bloqueo asesor por `(usuario, día)`. Libro y check-in
-- en la MISMA transacción.
--
-- TELÉFONO. La respuesta trae `datos` (la fila final) para que la app la FIJE en su almacén local, igual que el
-- total del agua: sin eso, el sync del teléfono subiría su copia vieja y pisaría lo que escribió Praxis.
--
-- FUERA A PROPÓSITO. Deshacer el check-in (D5): `praxis_deshacer` lo sigue rechazando; el libro ya guarda el
-- `antes` por campo para cuando llegue.
--
-- CÓMO REVERTIRLA:
--   begin;
--   drop function if exists public.praxis_aplicar_checkin(text, int, jsonb);
--   -- y volver a correr la sección 1 de la 0048 (ranking_disciplina_vivo tal cual estaba)
--   commit;
--   Los check-ins ya escritos se quedan (son datos de la persona); las filas del libro 'checkin' también.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1 · Guardar el check-in confirmado
-- ---------------------------------------------------------------------------
create or replace function public.praxis_aplicar_checkin(
  p_mensaje_id text,
  p_indice     int,
  p_parche     jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_hoy      date := (now() at time zone 'America/Bogota')::date;
  v_mensaje  text := btrim(p_mensaje_id);
  v_clave    text;
  v_valor    jsonb;
  v_texto    text;
  v_libro    uuid;
  v_fila_id  text;
  v_datos    jsonb;
  v_existia  boolean;
  v_antes    jsonb;
  v_nuevo    jsonb;
  v_completo boolean;
begin
  if v_uid is null then
    raise exception 'praxis_aplicar_checkin: hace falta una sesion' using errcode = '42501';
  end if;
  if v_mensaje is null or length(v_mensaje) not between 1 and 120 then
    raise exception 'praxis_aplicar_checkin: mensaje_id invalido' using errcode = '22023';
  end if;
  if p_indice is null or p_indice not between 0 and 11 then
    raise exception 'praxis_aplicar_checkin: indice invalido' using errcode = '22023';
  end if;
  if p_parche is null or jsonb_typeof(p_parche) <> 'object' or p_parche = '{}'::jsonb then
    raise exception 'praxis_aplicar_checkin: el parche debe traer al menos un campo' using errcode = '22023';
  end if;

  -- Cada campo en la escala del formulario (CheckinForm.tsx). Lo demás se rechaza entero.
  for v_clave, v_valor in select key, value from jsonb_each(p_parche) loop
    v_texto := v_valor #>> '{}';
    if v_clave in ('rendimiento', 'calidadSueno', 'alimentacion') then
      if jsonb_typeof(v_valor) <> 'string' or v_texto not in ('MALA', 'REGULAR', 'BUENA') then
        raise exception 'praxis_aplicar_checkin: % debe ser MALA, REGULAR o BUENA', v_clave using errcode = '22023';
      end if;
    elsif v_clave in ('motivacion', 'cansancio', 'estres') then
      if jsonb_typeof(v_valor) <> 'string' or v_texto not in ('POCO', 'REGULAR', 'MUCHO') then
        raise exception 'praxis_aplicar_checkin: % debe ser POCO, REGULAR o MUCHO', v_clave using errcode = '22023';
      end if;
    elsif v_clave = 'hambreEscala' then
      if jsonb_typeof(v_valor) <> 'number' or v_texto !~ '^(10|[1-9])$' then
        raise exception 'praxis_aplicar_checkin: el hambre va de 1 a 10, en enteros' using errcode = '22023';
      end if;
    elsif v_clave = 'dolor' then
      if jsonb_typeof(v_valor) <> 'number' or v_texto !~ '^0(\.0+)?$' then
        raise exception 'praxis_aplicar_checkin: por aqui el dolor solo admite 0 (sin dolor)' using errcode = '22023';
      end if;
    elsif v_clave = 'horasSueno' then
      if jsonb_typeof(v_valor) <> 'number' or v_texto !~ '^([0-9]|1[0-4])(\.[05]0*)?$' or v_texto::numeric > 14 then
        raise exception 'praxis_aplicar_checkin: las horas de sueno van de 0 a 14, de media en media' using errcode = '22023';
      end if;
    else
      raise exception 'praxis_aplicar_checkin: el campo % no se guarda por esta via', v_clave using errcode = '22023';
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtext('ck-' || v_uid::text || '-' || v_hoy::text));

  -- 1) El libro primero: si la tarjeta ya estaba, no se escribe nada.
  insert into public.praxis_registros_aplicados (usuario_id, tipo, mensaje_id, indice, ref)
  values (v_uid, 'checkin', v_mensaje, p_indice,
          jsonb_build_object('fecha', v_hoy, 'campos', (select jsonb_agg(k order by k) from jsonb_object_keys(p_parche) k)))
  on conflict (usuario_id, mensaje_id, indice) do nothing
  returning id into v_libro;

  if v_libro is null then
    return jsonb_build_object(
      'ya_aplicado', true,
      'registro_id', (select r.id from public.praxis_registros_aplicados r
                       where r.usuario_id = v_uid and r.mensaje_id = v_mensaje and r.indice = p_indice),
      'fecha', v_hoy,
      'datos', (select c.datos from public.checkins c where c.usuario_id = v_uid and c.fecha = v_hoy));
  end if;

  -- 2) La fila de hoy (una por usuario y día). Si no existe, nace con el mismo id que arma la app.
  select c.id, c.datos into v_fila_id, v_datos
    from public.checkins c where c.usuario_id = v_uid and c.fecha = v_hoy
    for update;
  v_existia := found;
  if not v_existia then
    v_fila_id := 'ck-' || v_uid::text || '-' || v_hoy::text;   -- CheckinForm.tsx: `ck-${usuarioId}-${fecha}`
    v_datos := jsonb_build_object('id', v_fila_id, 'usuarioId', v_uid::text, 'fecha', v_hoy::text);
  end if;

  -- El antes de CADA campo tocado (null = no estaba).
  select jsonb_object_agg(k, v_datos -> k) into v_antes from jsonb_object_keys(p_parche) k;

  v_nuevo := v_datos || p_parche;
  if p_parche ? 'horasSueno' and not coalesce(v_nuevo -> 'anotadoHoy', '[]'::jsonb) ? 'horasSueno' then
    v_nuevo := jsonb_set(v_nuevo, '{anotadoHoy}', coalesce(v_nuevo -> 'anotadoHoy', '[]'::jsonb) || '["horasSueno"]'::jsonb);
  end if;

  -- 3) ¿Completo? Los 8 obligatorios del formulario.
  v_completo := v_nuevo ?& array['rendimiento', 'motivacion', 'hambreEscala', 'cansancio', 'estres', 'dolor', 'calidadSueno', 'alimentacion'];
  v_nuevo := case when v_completo then v_nuevo - 'parcial' else v_nuevo || '{"parcial": true}'::jsonb end;

  insert into public.checkins (id, usuario_id, fecha, datos)
  values (v_fila_id, v_uid, v_hoy, v_nuevo)
  on conflict (usuario_id, fecha) do update set datos = excluded.datos;

  update public.praxis_registros_aplicados
     set ref     = ref || jsonb_build_object('fila_id', v_fila_id),
         antes   = case when v_existia then jsonb_build_object('campos', v_antes, 'parcial', coalesce(v_datos -> 'parcial', 'false'::jsonb)) end,
         despues = jsonb_build_object('campos', p_parche, 'parcial', not v_completo)
   where id = v_libro;

  return jsonb_build_object('ya_aplicado', false, 'registro_id', v_libro, 'fecha', v_hoy, 'parcial', not v_completo, 'datos', v_nuevo);
end
$$;

comment on function public.praxis_aplicar_checkin(text, int, jsonb) is
  'Escribe en el check-in de HOY (Bogota) de quien llama solo los campos confirmados en la tarjeta de Praxis, una vez por tarjeta, '
  'con el antes por campo en el libro. Marca datos.parcial si falta alguno de los 8 obligatorios. Dolor solo 0. Devuelve datos para que la app los fije. 0168.';

revoke execute on function public.praxis_aplicar_checkin(text, int, jsonb) from public, anon;
grant execute on function public.praxis_aplicar_checkin(text, int, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2 · Ranking: un check-in a medias no cuenta (decisión de Bryan, 7-nov-2026)
-- ---------------------------------------------------------------------------
-- Cuerpo IDÉNTICO al de la 0048, salvo `registro_checkins`, que ahora excluye `datos.parcial = true`.

create or replace function public.ranking_disciplina_vivo()
returns table (
  usuario_id uuid,
  nombre text,
  iniciales text,
  sesiones_completas int,
  dias_cumplidos int,
  checkins int,
  series_registradas int,
  ejercicios_progresados int,
  preguntas int,
  puntos int
)
language sql
stable security definer set search_path = public
as $vivo$
  with asesorados as (
    select id, nombre, avatar_iniciales
    from public.usuarios_app
    where rol = 'asesorado'
  ),
  sesiones as (
    select m.usuario_id,
      count(*) filter (
        where (
          s.value ->> 'tipo' = 'metabolica'
          and jsonb_array_length(coalesce(s.value -> 'bloquesCardio', '[]'::jsonb)) > 0
          and not exists (
            select 1
            from jsonb_array_elements(coalesce(s.value -> 'bloquesCardio', '[]'::jsonb)) b
            where b.value ->> 'hechoEn' is null
          )
        ) or (
          coalesce(s.value ->> 'tipo', 'fuerza') <> 'metabolica'
          and jsonb_array_length(coalesce(s.value -> 'ejercicios', '[]'::jsonb)) > 0
          and not exists (
            select 1
            from jsonb_array_elements(coalesce(s.value -> 'ejercicios', '[]'::jsonb)) e
            where jsonb_array_length(coalesce(e.value -> 'series', '[]'::jsonb))
              < coalesce((e.value ->> 'sets')::int, 1)
          )
        )
      ) as completas
    from public.microciclos m
    cross join lateral jsonb_array_elements(m.datos -> 'sesiones') s
    where m.estado = 'activo'
    group by m.usuario_id
  ),
  series as (
    select m.usuario_id, count(*) as n
    from public.microciclos m
    cross join lateral jsonb_array_elements(m.datos -> 'sesiones') s
    cross join lateral jsonb_array_elements(coalesce(s.value -> 'ejercicios', '[]'::jsonb)) e
    cross join lateral jsonb_array_elements(coalesce(e.value -> 'series', '[]'::jsonb)) sr
    where m.estado = 'activo'
    group by m.usuario_id
  ),
  cargas as (
    select m.usuario_id,
      e.value ->> 'nombre' as ejercicio,
      s.ordinality as sesion_orden,
      max((sr.value ->> 'cargaKg')::numeric) as mejor
    from public.microciclos m
    cross join lateral jsonb_array_elements(m.datos -> 'sesiones') with ordinality s(value, ordinality)
    cross join lateral jsonb_array_elements(coalesce(s.value -> 'ejercicios', '[]'::jsonb)) e
    cross join lateral jsonb_array_elements(coalesce(e.value -> 'series', '[]'::jsonb)) sr
    where m.estado = 'activo'
    group by m.usuario_id, e.value ->> 'nombre', s.ordinality
  ),
  primeras as (
    select distinct on (usuario_id, ejercicio)
      usuario_id, ejercicio, sesion_orden as primera_orden, mejor as primera_carga
    from cargas
    order by usuario_id, ejercicio, sesion_orden
  ),
  progresion as (
    select p.usuario_id, count(*) as n
    from primeras p
    where exists (
      select 1 from cargas c
      where c.usuario_id = p.usuario_id
        and c.ejercicio = p.ejercicio
        and c.sesion_orden > p.primera_orden
        and c.mejor > p.primera_carga
    )
    group by p.usuario_id
  ),
  adherencia as (
    select usuario_id,
      count(*) filter (where estado = 'si') as dias_si,
      count(*) filter (where estado = 'parcial') as dias_parcial
    from public.adherencias
    where fecha >= current_date - 30
    group by usuario_id
  ),
  registro_checkins as (
    select usuario_id, count(*) as n
    from public.checkins
    where fecha >= current_date - 30
      and coalesce(datos ->> 'parcial', 'false') <> 'true'   -- 0168: a medias no cuenta
    group by usuario_id
  ),
  consultas as (
    select msj.de_id as usuario_id, count(*) as n
    from public.mensajes msj
    join public.usuarios_app coach on coach.id = msj.para_id and coach.rol = 'coach'
    where msj.fecha_iso >= current_date - 30
    group by msj.de_id
  )
  select
    a.id,
    a.nombre,
    a.avatar_iniciales,
    coalesce(s.completas, 0)::int,
    (coalesce(adh.dias_si, 0) + coalesce(adh.dias_parcial, 0))::int,
    coalesce(rc.n, 0)::int,
    coalesce(sr.n, 0)::int,
    coalesce(pr.n, 0)::int,
    coalesce(cq.n, 0)::int,
    (
      coalesce(s.completas, 0) * 3
      + coalesce(adh.dias_si, 0) * 2
      + coalesce(adh.dias_parcial, 0)
      + coalesce(rc.n, 0)
      + coalesce(pr.n, 0) * 4
      + least(coalesce(cq.n, 0), 10)
    )::int as puntos
  from asesorados a
  left join sesiones s on s.usuario_id = a.id
  left join series sr on sr.usuario_id = a.id
  left join progresion pr on pr.usuario_id = a.id
  left join adherencia adh on adh.usuario_id = a.id
  left join registro_checkins rc on rc.usuario_id = a.id
  left join consultas cq on cq.usuario_id = a.id
  order by puntos desc, a.nombre;
$vivo$;

revoke all on function public.ranking_disciplina_vivo() from public;
revoke execute on function public.ranking_disciplina_vivo() from anon, authenticated;

commit;
