# Firma de revisiones desde Alpha

El coach necesita ver el guion y reproducir el archivo antes de aprobar la versión que recibirá el asesorado. La ruta `/coach/revisiones` estará protegida por el layout del coach y las operaciones por una RPC que comprueba su rol en el servidor. No habrá aprobación automática ni firma masiva.

Cada modificación del contenido incrementa una versión en la base y retira cualquier firma. La RPC compara la versión vista con la vigente bajo bloqueo de fila. Las correcciones son solicitudes, no cambios del guion de un vídeo ya grabado: dejan la revisión pendiente hasta reemplazar el contenido.

El publicador debe usar una ruta nueva para cada subida, sin sobrescribir objetos existentes. Las rutas históricas fijas se pueden reproducir pero no firmar desde esta bandeja hasta republicar con el publicador actualizado. No se migran ni publican datos reales automáticamente.

La página distingue carga, error de acceso/configuración, lista vacía, archivo inaccesible y conflicto de versión. Una firma no se muestra como realizada hasta recibir confirmación del servidor.
