export class ErrorDeSalon extends Error {
  constructor(
    public readonly codigo: 'PETICION_INVALIDA' | 'NO_AUTORIZADO' | 'PERSISTENCIA_NO_DISPONIBLE',
    mensaje: string,
    public readonly estadoHttp: 400 | 401 | 503,
  ) {
    super(mensaje)
    this.name = 'ErrorDeSalon'
  }
}
