import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { activeCycle, requireWindowOpen } from './cycles'
import { formatDay, isWindowOpenFor, windowOf } from './lib/cycleRules'
import { FIELD_LIMIT, ROW_LIMIT } from './lib/registrationLimits'
import { LETTER_LIMIT } from './lib/registrationSchema'
import { validateRegistration } from './lib/registrationRules'
import type { ActionErrorCode } from './lib/errorCodes'
import { requirePermission, requireUser, currentUser } from './auth'
import type { Doc } from './_generated/dataModel'
import { vBranch } from './schema'

/**
 * Form payload. The fields of registro_xuntas.html, with one departure:
 * its single "ciudad y estado" box is `state` and `city` here, because a
 * state picked from the 32 is a field we can group and count by and a typed
 * "Monterrey, NL" is not.
 */
const vRegistrationData = v.object({
  personal: v.object({
    name: v.string(),
    email: v.string(),
    whatsapp: v.string(),
    birthDate: v.string(),
    branch: vBranch,
    state: v.string(),
    city: v.string(),
  }),
  academic: v.object({
    school: v.string(),
    grade: v.string(),
    graduationYear: v.optional(v.string()),
    interest: v.optional(v.string()),
  }),
  athletic: v.object({
    club: v.string(),
    coach: v.string(),
    ghin: v.string(),
    amateurStatus: v.boolean(),
  }),
  results: v.array(v.object({ tournament: v.string(), result: v.string() })),
  rankings: v.array(v.object({ name: v.string(), position: v.string() })),
  calendar: v.array(v.object({ event: v.string(), date: v.string() })),
  motivationLetter: v.string(),
  confirmations: v.object({
    rules: v.boolean(),
    scholarshipUnderstood: v.boolean(),
    privacy: v.boolean(),
  }),
})

/**
 * The registration fields that are actually data, without the metadata
 * (`status`, `updatedAt`, etc.). This is what gets compared to decide whether
 * there is anything to write.
 */
const DATA_FIELDS = [
  'personal',
  'academic',
  'athletic',
  'results',
  'rankings',
  'calendar',
  'motivationLetter',
  'confirmations',
] as const

function isUnchanged(
  existing: Doc<'registrations'>,
  data: typeof vRegistrationData.type,
): boolean {
  return DATA_FIELDS.every(
    (field) => JSON.stringify(existing[field]) === JSON.stringify(data[field]),
  )
}

/**
 * Errors cross the wire as codes so the browser can say them in the reader's
 * language. A plain `Error` message cannot: it arrives wrapped in Convex's
 * own framing and is whatever language the server happened to be written in.
 */
function fail(code: ActionErrorCode): never {
  throw new ConvexError({ code })
}

/**
 * A draft does not go through `validate`, so without this an arbitrarily large
 * document could be saved until hitting Convex's 1 MB limit — and the error
 * would surface as an opaque failure halfway through filling the form.
 */
function requireReasonableSizes(data: typeof vRegistrationData.type) {
  if (data.motivationLetter.length > LETTER_LIMIT) {
    fail('letter_too_long')
  }
  if (
    data.results.length > ROW_LIMIT ||
    data.rankings.length > ROW_LIMIT ||
    data.calendar.length > ROW_LIMIT
  ) {
    fail('too_many_rows')
  }

  const texts = [
    ...Object.values(data.personal),
    ...Object.values(data.academic),
    ...Object.values(data.athletic),
    ...data.results.flatMap((r) => [r.tournament, r.result]),
    ...data.rankings.flatMap((r) => [r.name, r.position]),
    ...data.calendar.flatMap((c) => [c.event, c.date]),
  ]
  for (const t of texts) {
    if (typeof t === 'string' && t.length > FIELD_LIMIT) {
      fail('field_too_long')
    }
  }
}

/** The signed-in user's registration, with the window and the lock resolved. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx)
    if (!user) return null

    const cycle = await activeCycle(ctx)
    const registration = await ctx.db
      .query('registrations')
      .withIndex('by_user_cycle', (q) => q.eq('userId', user._id).eq('cycle', cycle.cycle))
      .unique()
    const { closesAtMs } = windowOf(cycle)
    return {
      registration,
      editable: isWindowOpenFor(cycle),
      closesAt: closesAtMs,
      cycle: cycle.cycle,
    }
  },
})

/**
 * Draft autosave. It does not validate the fields: it is a draft. It does
 * bound the sizes, because a Convex document has a 1 MB cap and this gets
 * written without going through `validate`.
 */
export const saveDraft = mutation({
  args: { data: vRegistrationData },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const cycle = await requireWindowOpen(ctx)
    requireReasonableSizes(args.data)

    const existing = await ctx.db
      .query('registrations')
      .withIndex('by_user_cycle', (q) => q.eq('userId', user._id).eq('cycle', cycle.cycle))
      .unique()

    const now = Date.now()

    if (existing) {
      if (existing.status === 'validated' || existing.status === 'rejected') {
        fail('already_reviewed')
      }

      // No changes, no write.
      //
      // It is not just savings: `updatedAt` changes the document, that
      // invalidates the reactive query feeding the screen, the screen
      // re-renders and the autosave fires again. The client already breaks
      // that loop; this breaks it here too, so a stale tab or a buggy client
      // cannot reopen it.
      if (isUnchanged(existing, args.data)) return existing._id

      await ctx.db.patch(existing._id, { ...args.data, updatedAt: now })
      return existing._id
    }

    return await ctx.db.insert('registrations', {
      userId: user._id,
      cycle: cycle.cycle,
      ...args.data,
      status: 'draft',
      updatedAt: now,
    })
  },
})

/**
 * Submission. Validates for real and fires the confirmation.
 *
 * Submitting is allowed even if the guardian authorization is missing: the
 * registration is flagged and a person resolves it. A minor is never
 * auto-rejected because their mother or father did not open an email.
 */
export const submit = mutation({
  args: { data: vRegistrationData },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const cycle = await requireWindowOpen(ctx)
    requireReasonableSizes(args.data)

    /**
     * No birth date, no submission. It is the age gate's backstop: if the
     * account was created without a valid pre-signup, we do not know whether
     * a guardian's authorization is needed, and a minor's registration
     * without that consent must not get in. The screen already asks for the
     * date before reaching here; this exists in case someone calls the
     * mutation directly.
     */
    if (user.birthDate === undefined) {
      return {
        ok: false as const,
        errors: [{ field: 'personal.birthDate' as const, code: 'birth_date_missing' as const }],
      }
    }

    const errors = validateRegistration(args.data)
    if (errors.length > 0) return { ok: false as const, errors }

    const existing = await ctx.db
      .query('registrations')
      .withIndex('by_user_cycle', (q) => q.eq('userId', user._id).eq('cycle', cycle.cycle))
      .unique()

    if (existing && (existing.status === 'validated' || existing.status === 'rejected')) {
      fail('already_reviewed')
    }

    const now = Date.now()
    const fields = {
      ...args.data,
      status: 'submitted' as const,
      submittedAt: existing?.submittedAt ?? now,
      updatedAt: now,
    }

    if (existing) {
      await ctx.db.patch(existing._id, fields)
    } else {
      await ctx.db.insert('registrations', { userId: user._id, cycle: cycle.cycle, ...fields })
    }

    // Only the first submission is confirmed; later edits do not re-send.
    const isFirstSubmit = !existing || existing.status !== 'submitted'
    if (isFirstSubmit) {
      const guardian = await ctx.db
        .query('guardianAuth')
        .withIndex('by_user_cycle', (q) => q.eq('userId', user._id).eq('cycle', cycle.cycle))
        .unique()

      // It goes to the ACCOUNT email, which Clerk already verified — not to
      // the one typed into the form. If it went to the form's, anyone with a
      // session could make registro@xuntas.org send an email to whatever
      // address they wanted.
      await ctx.scheduler.runAfter(0, internal.emails.sendAthleteConfirmation, {
        to: user.email,
        name: args.data.personal.name,
        guardianMissing: guardian !== null && guardian.confirmedAt === undefined,
        closesOnText: formatDay(cycle.closesOn, 'es'),
        reviewOnText: formatDay(cycle.reviewOn, 'es'),
        cycle: cycle.cycle,
      })
    }

    return { ok: true as const, errors: [] }
  },
})

// ---------------------------------------------------------------------------
// Administration. The table UI lands after launch; these functions exist so
// the XUNTAS admins can validate on the fly.
// ---------------------------------------------------------------------------

export const listForAdmin = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, 'review_registrations')
    // Plan 3 gives this its own `cycle` argument; for now it is the active one.
    const cycle = (await activeCycle(ctx)).cycle

    const registrations = args.status
      ? await ctx.db
          .query('registrations')
          .withIndex('by_cycle_status', (q) => q.eq('cycle', cycle).eq('status', args.status as never))
          .collect()
      : await ctx.db
          .query('registrations')
          .withIndex('by_user_cycle', (q) => q)
          .filter((q) => q.eq(q.field('cycle'), cycle))
          .collect()

    return await Promise.all(
      registrations.map(async (r) => {
        const guardian = await ctx.db
          .query('guardianAuth')
          .withIndex('by_user_cycle', (q) => q.eq('userId', r.userId).eq('cycle', cycle))
          .unique()
        return {
          ...r,
          guardianRequired: guardian !== null,
          guardianConfirmed: guardian === null || guardian.confirmedAt !== undefined,
        }
      }),
    )
  },
})

export const review = mutation({
  args: {
    registrationId: v.id('registrations'),
    status: v.union(v.literal('validated'), v.literal('rejected')),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requirePermission(ctx, 'review_registrations')
    await ctx.db.patch(args.registrationId, {
      status: args.status,
      validatedBy: admin._id,
      validatedAt: Date.now(),
      validationNote: args.note,
    })
  },
})
