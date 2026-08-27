/**
 * Reexporta las constantes del ciclo desde el backend.
 *
 * Las fechas de la convocatoria viven en `convex/lib/ciclo.ts` y en ningún otro
 * lado: si el cliente y el servidor pudieran discrepar sobre cuándo cierra el
 * registro, discreparían justo el 18 de septiembre a las 23:59.
 */
export {
  CICLO_ACTUAL,
  APERTURA_MS,
  CIERRE_MS,
  FECHA_REVISION,
  ventanaAbierta,
  edadEn,
  esMenorDeEdad,
} from '../../convex/lib/ciclo'
