-- 0062 - El saludo es una via propia.
--
-- Medido el 2026-09-10 sobre una consulta real: «hola» se parece a la ficha mas
-- cercana un 0,29, muy por debajo del 0,42 minimo, asi que caia en `escalado` y
-- el asesorado recibia «esa no te la puedo responder bien con lo que tengo».
-- Es la peor primera frase posible para quien acaba de abrir el chat.
--
-- Ahora un saludo se contesta con una bienvenida, y esa decision necesita
-- nombre propio en el registro: contarla como `escalado` inflaria justo el
-- numero que dice cuantas preguntas se le escapan al asistente.

alter table public.consultas_chat drop constraint if exists consultas_chat_via_check;

alter table public.consultas_chat add constraint consultas_chat_via_check
  check (via = any (array['ficha'::text, 'ficha_tentativa'::text, 'ia_vivo'::text,
                          'escalado'::text, 'saludo'::text]));
