import { diasAtras, fechaIsoAtras } from './fechas'
import type { Mensaje, PremiacionCoach } from '../../domain/types'

export const mensajes: Mensaje[] = [
  {
    id: 'msg-1',
    deId: 'u-valentina',
    paraId: 'u-bryan',
    fechaIso: fechaIsoAtras(5, '20:15:00'),
    texto: 'Coach, hoy el hip thrust con 85 se movió muy bien, sentí que había una rep más. ¿Subo la próxima o mantengo?',
    leido: true,
  },
  {
    id: 'msg-2',
    deId: 'u-bryan',
    paraId: 'u-valentina',
    fechaIso: fechaIsoAtras(5, '21:02:00'),
    texto: 'Excelente señal. Mantén 85 esta semana y busca las 12 reps limpias con pausa arriba. Si las sacas con RIR 2, en M23 subimos a 90.',
    leido: true,
  },
  {
    id: 'msg-3',
    deId: 'u-valentina',
    paraId: 'u-bryan',
    fechaIso: fechaIsoAtras(2, '08:40:00'),
    texto: 'Listo coach. Otra cosa: esta semana tengo un viaje de trabajo jueves y viernes, ¿cómo reorganizo las sesiones?',
    leido: true,
  },
  {
    id: 'msg-4',
    deId: 'u-bryan',
    paraId: 'u-valentina',
    fechaIso: fechaIsoAtras(1, '19:30:00'),
    texto: 'Pásame el UPPER B al miércoles y el FULL C al sábado. Jueves y viernes: 10k pasos y las comidas del menú BAJO. El microciclo no se daña por reacomodar, se daña por desaparecer 😉',
    leido: false,
  },
  {
    id: 'msg-5',
    deId: 'u-mateo',
    paraId: 'u-bryan',
    fechaIso: fechaIsoAtras(1, '22:10:00'),
    texto: 'Coach, se me está complicando llegar a las calorías del día ALTO, ¿puedo meter un batido extra?',
    leido: false,
  },
]

export const premiaciones: PremiacionCoach[] = [
  {
    id: 'prem-1',
    usuarioId: 'u-valentina',
    titulo: 'Mejor progresión del mes',
    fecha: diasAtras(17),
    nota: 'Junio: +5 kg en hip thrust, adherencia nutricional del 92% y todos los check-ins al día. Disciplina de otra categoría.',
  },
]
