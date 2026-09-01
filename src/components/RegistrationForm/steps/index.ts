import type { ComponentType } from 'react'
import * as m from '../../../paraglide/messages.js'
import Step1Personal, { fields as f1 } from './Step1Personal'
import Step2Academic, { fields as f2 } from './Step2Academic'
import Step3Athletic, { fields as f3 } from './Step3Athletic'
import Step4Results, { fields as f4 } from './Step4Results'
import Step5Rankings, { fields as f5 } from './Step5Rankings'
import Step6Calendar, { fields as f6 } from './Step6Calendar'
import Step7Letter, { fields as f7 } from './Step7Letter'
import Step8Confirmations, { fields as f8 } from './Step8Confirmations'
import { RESULTS_MIN } from '../../../lib/registrationRules'
import type { StepFieldPath, StepFields } from '../../../lib/registrationSteps'
import type { StepProps } from './types'

export type StepDef = {
  /** The number the reader sees, and the one already in the approved copy. */
  n: number
  /**
   * Held as functions, not strings. Paraglide resolves the locale at runtime
   * and this module is evaluated once at import, so calling them here would
   * freeze the form into whichever language happened to load first.
   */
  title: () => string
  sub?: () => string
  fields: readonly StepFieldPath[]
  Component: ComponentType<StepProps>
}

/**
 * The eight steps, in order, each paired with the fields it renders.
 *
 * One step per section of the approved copy. Grouping them would have meant
 * new headings in two languages and orphaned the `reg_sN_*` keys that already
 * exist, for a saving of a few clicks.
 */
export const STEPS: readonly StepDef[] = [
  { n: 1, title: m.reg_s1_title, sub: m.reg_s1_sub, fields: f1, Component: Step1Personal },
  { n: 2, title: m.reg_s2_title, sub: m.reg_s2_sub, fields: f2, Component: Step2Academic },
  { n: 3, title: m.reg_s3_title, fields: f3, Component: Step3Athletic },
  {
    n: 4,
    title: m.reg_s4_title,
    /* The one heading whose copy carries a number the rules own, so it is
       filled from the rule rather than written out twice. */
    sub: () => m.reg_s4_sub({ n: RESULTS_MIN }),
    fields: f4,
    Component: Step4Results,
  },
  { n: 5, title: m.reg_s5_title, sub: m.reg_s5_sub, fields: f5, Component: Step5Rankings },
  { n: 6, title: m.reg_s6_title, sub: m.reg_s6_sub, fields: f6, Component: Step6Calendar },
  { n: 7, title: m.reg_s7_title, sub: m.reg_s7_sub, fields: f7, Component: Step7Letter },
  { n: 8, title: m.reg_s8_title, fields: f8, Component: Step8Confirmations },
]

/** What `lib/registrationSteps` needs, which is the membership and nothing else. */
export const STEP_FIELDS: StepFields = STEPS.map((s) => s.fields)

export const LAST_STEP = STEPS.length - 1
