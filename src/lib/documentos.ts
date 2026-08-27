/**
 * Documentos que la convocatoria referencia y que tienen que existir antes de
 * abrir el registro.
 *
 * `listo: false` es una bandera deliberada, no un pendiente olvidado. Mientras
 * esté en falso:
 *
 * - la página del documento se muestra con un aviso de que es un borrador, y
 * - el formulario lo dice junto a la casilla que lo referencia.
 *
 * El aviso de privacidad es **bloqueante** para el lanzamiento: la casilla
 * `ck3` no puede enlazar a una página que no existe, y bajo la LFPDPPP no
 * debería aceptarse el registro de una persona menor de edad sin un aviso
 * publicado. Ver `docs/DECISIONES.md`.
 *
 * Cuando XUNTAS entregue el texto: se pega en el componente de la ruta y se
 * pone `listo: true`. Nada más.
 */
export const DOCUMENTOS = {
  avisoPrivacidad: {
    ruta: '/aviso-de-privacidad',
    listo: false,
  },
  bases: {
    ruta: '/bases',
    listo: false,
  },
} as const

/** ¿Falta publicar algún documento que la convocatoria da por hecho? */
export const HAY_DOCUMENTOS_PENDIENTES = Object.values(DOCUMENTOS).some((d) => !d.listo)
