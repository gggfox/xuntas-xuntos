import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as m from '../paraglide/messages.js'
import type { DatosRegistro, Fila } from '../lib/formulario'
import {
  LIMITE_CARTA,
  RANKINGS_FIJOS,
  filaVacia,
  registroVacio,
  validarRegistro,
} from '../lib/formulario'

type Props = {
  inicial: DatosRegistro
  editable: boolean
  onGuardarBorrador: (datos: DatosRegistro) => void
  onEnviar: (datos: DatosRegistro) => Promise<string[]>
  yaEnviado: boolean
}

/**
 * Formulario de registro. Los ocho apartados y sus textos son los de
 * registro_xuntas.html: XUNTAS ya los aprobó y cambiarlos reabre una
 * conversación que no cabe en el calendario.
 */
export default function FormularioRegistro({
  inicial,
  editable,
  onGuardarBorrador,
  onEnviar,
  yaEnviado,
}: Props) {
  const [datos, setDatos] = useState<DatosRegistro>(inicial)
  const [errores, setErrores] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const primerRender = useRef(true)

  // Autoguardado. Un formulario de ocho apartados con una carta de una cuartilla
  // no puede perderse porque se cayó el wifi en el club.
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false
      return
    }
    if (!editable) return
    const t = setTimeout(() => onGuardarBorrador(datos), 1200)
    return () => clearTimeout(t)
  }, [datos, editable, onGuardarBorrador])

  const set = useCallback(<K extends keyof DatosRegistro>(clave: K, valor: DatosRegistro[K]) => {
    setDatos((d) => ({ ...d, [clave]: valor }))
  }, [])

  const avance = useMemo(() => calcularAvance(datos), [datos])

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    const locales = validarRegistro(datos)
    if (locales.length > 0) {
      setErrores(locales)
      document.getElementById('errores')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setEnviando(true)
    try {
      const delServidor = await onEnviar(datos)
      setErrores(delServidor)
      if (delServidor.length > 0) {
        document.getElementById('errores')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      {/* Barra de avance pegajosa, como en el prototipo. */}
      <div className="sticky top-0 z-40 -mx-[22px] mb-8 border-b border-line bg-paper/95 px-[22px] py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="eyebrow whitespace-nowrap">{avance}% completado</span>
          <div className="h-[3px] flex-1 overflow-hidden rounded-sm bg-line">
            <i
              className="block h-full bg-yel transition-[width] duration-300"
              style={{ width: `${avance}%` }}
            />
          </div>
        </div>
      </div>

      {errores.length > 0 && (
        <div
          id="errores"
          role="alert"
          className="mb-8 rounded-[9px] border border-bad/40 bg-bad/5 px-5 py-4"
        >
          <b className="mb-2 block font-disp text-[14.5px] text-bad">
            Falta algo antes de enviar
          </b>
          <ul className="m-0 list-disc pl-5 text-[13px] text-ink-3">
            {errores.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <Apartado n={1} titulo={m.reg_s1_titulo()} sub={m.reg_s1_sub()}>
        <Rejilla>
          <Campo
            id="nom"
            label={m.reg_nombre()}
            req
            valor={datos.persona.nombre}
            onChange={(v) => set('persona', { ...datos.persona, nombre: v })}
            autoComplete="name"
          />
          <Campo
            id="mail"
            type="email"
            label={m.reg_email()}
            req
            valor={datos.persona.email}
            onChange={(v) => set('persona', { ...datos.persona, email: v })}
            autoComplete="email"
          />
          <Campo
            id="tel"
            type="tel"
            label={m.reg_whatsapp()}
            req
            valor={datos.persona.whatsapp}
            onChange={(v) => set('persona', { ...datos.persona, whatsapp: v })}
            autoComplete="tel"
          />
          <Campo
            id="nac"
            type="date"
            label={m.reg_nacimiento()}
            req
            valor={datos.persona.fechaNacimiento}
            onChange={(v) => set('persona', { ...datos.persona, fechaNacimiento: v })}
          />
          <Seleccion
            id="rama"
            label={m.reg_rama()}
            req
            valor={datos.persona.rama}
            onChange={(v) => set('persona', { ...datos.persona, rama: v as 'femenil' | 'varonil' })}
            opciones={[
              { v: '', t: m.reg_rama_selecciona() },
              { v: 'femenil', t: m.reg_rama_femenil() },
              { v: 'varonil', t: m.reg_rama_varonil() },
            ]}
          />
          <Campo
            id="ciudad"
            label={m.reg_ciudad()}
            req
            valor={datos.persona.ciudadEstado}
            onChange={(v) => set('persona', { ...datos.persona, ciudadEstado: v })}
          />
        </Rejilla>
      </Apartado>

      <Apartado n={2} titulo={m.reg_s2_titulo()} sub={m.reg_s2_sub()}>
        <Rejilla>
          <Campo
            id="esc"
            label={m.reg_escuela()}
            req
            valor={datos.academico.escuela}
            onChange={(v) => set('academico', { ...datos.academico, escuela: v })}
          />
          <Campo
            id="grado"
            label={m.reg_grado()}
            req
            valor={datos.academico.grado}
            onChange={(v) => set('academico', { ...datos.academico, grado: v })}
          />
          <Campo
            id="grad"
            label={m.reg_graduacion()}
            ayuda={m.reg_graduacion_ayuda()}
            valor={datos.academico.anioGraduacion ?? ''}
            onChange={(v) => set('academico', { ...datos.academico, anioGraduacion: v })}
          />
          <Campo
            id="interes"
            label={m.reg_interes()}
            valor={datos.academico.interes ?? ''}
            onChange={(v) => set('academico', { ...datos.academico, interes: v })}
          />
        </Rejilla>
      </Apartado>

      <Apartado n={3} titulo={m.reg_s3_titulo()}>
        <Rejilla>
          <Campo
            id="club"
            label={m.reg_club()}
            req
            valor={datos.deportivo.club}
            onChange={(v) => set('deportivo', { ...datos.deportivo, club: v })}
          />
          <Campo
            id="coach"
            label={m.reg_coach()}
            req
            valor={datos.deportivo.coach}
            onChange={(v) => set('deportivo', { ...datos.deportivo, coach: v })}
          />
          <Seleccion
            id="estatus"
            label={m.reg_estatus()}
            req
            ayuda={m.reg_estatus_ayuda()}
            valor={datos.deportivo.estatusAmateur ? 'amateur' : ''}
            onChange={(v) =>
              set('deportivo', { ...datos.deportivo, estatusAmateur: v === 'amateur' })
            }
            opciones={[
              { v: '', t: m.reg_rama_selecciona() },
              { v: 'amateur', t: m.reg_estatus_amateur() },
              { v: 'pro', t: m.reg_estatus_pro() },
            ]}
          />
          <Campo
            id="ghin"
            label={m.reg_ghin()}
            req
            valor={datos.deportivo.ghin}
            onChange={(v) => set('deportivo', { ...datos.deportivo, ghin: v })}
          />
        </Rejilla>
      </Apartado>

      <Apartado n={4} titulo={m.reg_s4_titulo()} sub={m.reg_s4_sub()}>
        <FilasDinamicas
          filas={datos.resultados.map((r) => ({ a: r.torneo, b: r.resultado }))}
          phA={m.reg_torneo_nombre()}
          phB={m.reg_torneo_resultado()}
          etiquetaAgregar={m.reg_agregar_torneo()}
          onChange={(filas) =>
            set('resultados', filas.map((f) => ({ torneo: f.a, resultado: f.b })))
          }
        />
      </Apartado>

      <Apartado n={5} titulo={m.reg_s5_titulo()} sub={m.reg_s5_sub()}>
        {RANKINGS_FIJOS.map((nombre, i) => (
          <div key={nombre} className="mb-[9px] grid grid-cols-[1fr_128px] gap-[10px]">
            <input className="fld-input bg-paper text-soft" value={nombre} readOnly tabIndex={-1} />
            <input
              className="fld-input"
              aria-label={`${m.reg_ranking_posicion()} ${nombre}`}
              placeholder={m.reg_ranking_posicion()}
              value={datos.rankings[i]?.posicion ?? ''}
              onChange={(e) => {
                const copia = [...datos.rankings]
                copia[i] = { nombre, posicion: e.target.value }
                set('rankings', copia)
              }}
            />
          </div>
        ))}
        <div className="mb-[9px] grid grid-cols-[1fr_128px] gap-[10px]">
          <input
            className="fld-input"
            placeholder={m.reg_ranking_otro()}
            aria-label={m.reg_ranking_otro()}
            value={datos.rankings[RANKINGS_FIJOS.length]?.nombre ?? ''}
            onChange={(e) => {
              const copia = [...datos.rankings]
              copia[RANKINGS_FIJOS.length] = {
                nombre: e.target.value,
                posicion: copia[RANKINGS_FIJOS.length]?.posicion ?? '',
              }
              set('rankings', copia)
            }}
          />
          <input
            className="fld-input"
            aria-label={`${m.reg_ranking_posicion()} ${m.reg_ranking_otro()}`}
            placeholder={m.reg_ranking_posicion()}
            value={datos.rankings[RANKINGS_FIJOS.length]?.posicion ?? ''}
            onChange={(e) => {
              const copia = [...datos.rankings]
              copia[RANKINGS_FIJOS.length] = {
                nombre: copia[RANKINGS_FIJOS.length]?.nombre ?? '',
                posicion: e.target.value,
              }
              set('rankings', copia)
            }}
          />
        </div>
      </Apartado>

      <Apartado n={6} titulo={m.reg_s6_titulo()} sub={m.reg_s6_sub()}>
        <FilasDinamicas
          filas={datos.calendario.map((c) => ({ a: c.evento, b: c.fecha }))}
          phA={m.reg_evento_nombre()}
          phB={m.reg_evento_fecha()}
          etiquetaAgregar={m.reg_agregar_evento()}
          onChange={(filas) => set('calendario', filas.map((f) => ({ evento: f.a, fecha: f.b })))}
        />
      </Apartado>

      <Apartado n={7} titulo={m.reg_s7_titulo()} sub={m.reg_s7_sub()}>
        <textarea
          id="carta"
          className="fld-input min-h-[240px] resize-y leading-[1.65]"
          value={datos.cartaMotivos}
          maxLength={LIMITE_CARTA}
          onChange={(e) => set('cartaMotivos', e.target.value)}
          aria-label={m.reg_s7_titulo()}
        />
        <p
          className={`mt-1.5 font-mono text-[11.5px] ${
            datos.cartaMotivos.length > LIMITE_CARTA * 0.92 ? 'text-warn' : 'text-soft'
          }`}
        >
          {datos.cartaMotivos.length.toLocaleString('es-MX')} /{' '}
          {LIMITE_CARTA.toLocaleString('es-MX')} caracteres
        </p>
      </Apartado>

      <Apartado n={8} titulo={m.reg_s8_titulo()}>
        <Casilla
          id="ck1"
          titulo={m.reg_ck_bases()}
          sub={m.reg_ck_bases_sub()}
          checked={datos.confirmaciones.bases}
          onChange={(v) => set('confirmaciones', { ...datos.confirmaciones, bases: v })}
        />
        <Casilla
          id="ck2"
          titulo={m.reg_ck_beca()}
          sub={m.reg_ck_beca_sub()}
          checked={datos.confirmaciones.becaSeOtorga}
          onChange={(v) => set('confirmaciones', { ...datos.confirmaciones, becaSeOtorga: v })}
        />
        <Casilla
          id="ck3"
          titulo={m.reg_ck_privacidad()}
          sub={m.reg_ck_privacidad_sub()}
          checked={datos.confirmaciones.privacidad}
          onChange={(v) => set('confirmaciones', { ...datos.confirmaciones, privacidad: v })}
        />
      </Apartado>

      <div className="mt-9 flex flex-wrap items-center gap-4">
        <button type="submit" className="btn" disabled={!editable || enviando}>
          {enviando ? m.comun_cargando() : yaEnviado ? m.reg_reenviar() : m.reg_enviar()}
        </button>
        <span className="eyebrow">{editable ? m.reg_cierre() : m.reg_cerrado()}</span>
      </div>
    </form>
  )
}

// --- piezas -----------------------------------------------------------------

function Apartado({
  n,
  titulo,
  sub,
  children,
}: {
  n: number
  titulo: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="mb-[34px] scroll-mt-20 border-0 p-0">
      <legend className="mb-[3px] flex items-baseline gap-[9px] p-0 font-disp text-[18px] font-bold">
        {n} · {titulo}
      </legend>
      {sub && <p className="mt-0 mb-[17px] max-w-[62ch] text-[13.5px] font-light text-soft">{sub}</p>}
      {children}
    </fieldset>
  )
}

function Rejilla({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-[15px] sm:grid-cols-2">{children}</div>
}

function Campo({
  id,
  label,
  req,
  ayuda,
  type = 'text',
  valor,
  onChange,
  autoComplete,
}: {
  id: string
  label: string
  req?: boolean
  ayuda?: string
  type?: string
  valor: string
  onChange: (v: string) => void
  autoComplete?: string
}) {
  return (
    <div className="mb-[15px] flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-medium">
        {label} {req && <span className="text-bad">*</span>}
      </label>
      <input
        id={id}
        type={type}
        className="fld-input"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
      {ayuda && <p className="text-[11.5px] text-soft">{ayuda}</p>}
    </div>
  )
}

function Seleccion({
  id,
  label,
  req,
  ayuda,
  valor,
  onChange,
  opciones,
}: {
  id: string
  label: string
  req?: boolean
  ayuda?: string
  valor: string
  onChange: (v: string) => void
  opciones: Array<{ v: string; t: string }>
}) {
  return (
    <div className="mb-[15px] flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-medium">
        {label} {req && <span className="text-bad">*</span>}
      </label>
      <select
        id={id}
        className="fld-input"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      >
        {opciones.map((o) => (
          <option key={o.v} value={o.v}>
            {o.t}
          </option>
        ))}
      </select>
      {ayuda && <p className="text-[11.5px] text-soft">{ayuda}</p>}
    </div>
  )
}

function Casilla({
  id,
  titulo,
  sub,
  checked,
  onChange,
}: {
  id: string
  titulo: string
  sub: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="mb-3 flex cursor-pointer gap-3 rounded-[9px] border border-line bg-card px-4 py-3.5"
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 flex-none accent-ochre"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <b className="block text-[13.5px] font-semibold">{titulo}</b>
        <span className="mt-1 block text-[12.5px] leading-relaxed font-light text-soft">{sub}</span>
      </span>
    </label>
  )
}

/** Filas que crecen: resultados y calendario. Siempre queda una vacía al final. */
function FilasDinamicas({
  filas,
  phA,
  phB,
  etiquetaAgregar,
  onChange,
}: {
  filas: Fila[]
  phA: string
  phB: string
  etiquetaAgregar: string
  onChange: (filas: Fila[]) => void
}) {
  function editar(i: number, campo: 'a' | 'b', v: string) {
    const copia = filas.map((f, j) => (j === i ? { ...f, [campo]: v } : f))
    onChange(copia)
  }

  return (
    <>
      {filas.map((f, i) => (
        <div key={i} className="mb-[9px] grid grid-cols-[1fr_150px_40px] items-center gap-[9px]">
          <input
            className="fld-input"
            placeholder={phA}
            aria-label={`${phA} ${i + 1}`}
            value={f.a}
            onChange={(e) => editar(i, 'a', e.target.value)}
          />
          <input
            className="fld-input"
            placeholder={phB}
            aria-label={`${phB} ${i + 1}`}
            value={f.b}
            onChange={(e) => editar(i, 'b', e.target.value)}
          />
          <button
            type="button"
            className="rounded-ctl border border-line-2 py-2 text-soft hover:border-bad hover:text-bad"
            aria-label={`Quitar fila ${i + 1}`}
            onClick={() => onChange(filas.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={() => onChange([...filas, filaVacia()])}>
        {etiquetaAgregar}
      </button>
    </>
  )
}

/** Avance aproximado, solo para la barra. No es la validación. */
function calcularAvance(d: DatosRegistro): number {
  const campos = [
    d.persona.nombre,
    d.persona.email,
    d.persona.whatsapp,
    d.persona.fechaNacimiento,
    d.persona.rama,
    d.persona.ciudadEstado,
    d.academico.escuela,
    d.academico.grado,
    d.deportivo.club,
    d.deportivo.coach,
    d.deportivo.ghin,
    d.resultados.some((r) => r.torneo && r.resultado) ? 'x' : '',
    d.cartaMotivos,
    d.confirmaciones.bases ? 'x' : '',
    d.confirmaciones.becaSeOtorga ? 'x' : '',
    d.confirmaciones.privacidad ? 'x' : '',
  ]
  const llenos = campos.filter((c) => String(c).trim()).length
  return Math.round((llenos / campos.length) * 100)
}

export { registroVacio }
