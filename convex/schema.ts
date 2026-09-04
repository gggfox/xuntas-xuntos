import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * Current cycle. Every registration and every guardian authorization hangs off
 * a cycle, so the call for applications can run again in 2027 without
 * migrating anything.
 */
export const CURRENT_CYCLE = '2026-2027'

/** Program branch. XUNTAS = women's, XUNTOS = men's. */
export const vBranch = v.union(v.literal('womens'), v.literal('mens'))

/**
 * Account roles. Owned by Convex — see docs/DECISIONS.md, "Convex owns roles".
 * `role` (singular, Clerk-mirrored) is on its way out: this deploy adds
 * `roles`, the backfill fills it, the next deploy drops `role`.
 */
export const vRole = v.union(
  v.literal('athlete'),
  v.literal('admin'),
  v.literal('master_admin'),
  v.literal('coach'),
  v.literal('finance'),
  v.literal('health'),
)

/**
 * Status of the REGISTRATION (the data), not of the account nor the guardian.
 * The three axes are modeled separately on purpose — see docs/DECISIONS.md.
 */
export const vRegistrationStatus = v.union(
  v.literal('draft'),
  v.literal('submitted'),
  v.literal('validated'),
  v.literal('rejected'),
)

/**
 * The reader's theme. Absent means never chosen, which behaves as `system`.
 * Stored rather than inferred so the choice follows the person to a borrowed
 * laptop — which is the whole point of remembering it.
 */
export const vThemePreference = v.union(
  v.literal('system'),
  v.literal('light'),
  v.literal('dark'),
)

const vResult = v.object({
  tournament: v.string(),
  result: v.string(),
})

const vRanking = v.object({
  name: v.string(),
  position: v.string(),
})

const vCalendarEvent = v.object({
  event: v.string(),
  date: v.string(),
})

export default defineSchema({
  /**
   * Age gate resolved ON THE SERVER, before the account exists.
   *
   * The birth date and guardian data used to travel in Clerk's
   * `unsafeMetadata`, which the client can write whenever it wants: you could
   * declare yourself of legal age and skip the guardian authorization without
   * leaving a trace. Now `/empezar` calls `preSignups.create`, the server
   * computes `isMinor` and stores the result here; only `token` travels
   * through Clerk, which is an opaque reference and carries no personal data.
   *
   * Short-lived on purpose: if the signup never completes, this stores the
   * birth date of a minor and their guardian's email without anyone having
   * consented to anything. `crons.ts` deletes them when they expire.
   */
  preSignups: defineTable({
    token: v.string(),
    birthDate: v.string(), // ISO yyyy-mm-dd
    /** Computed by the server with `isUnderage`. The client does not send it. */
    isMinor: v.boolean(),
    guardianName: v.optional(v.string()),
    guardianEmail: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
    /** clerkId of the account that consumed it. Single use. */
    usedBy: v.optional(v.string()),
  })
    .index('by_token', ['token'])
    .index('by_expires', ['expiresAt']),

  /**
   * Staff invitations. Bound to an email: the webhook redeems one by matching
   * the account's primary address, so a forwarded link is worth nothing to
   * anyone else. `token` only names the page the invitee lands on.
   */
  staffInvites: defineTable({
    email: v.string(),
    roles: v.array(vRole),
    token: v.string(),
    invitedBy: v.id('users'),
    createdAt: v.number(),
    expiresAt: v.number(),
    lastSentAt: v.number(),
    timesSent: v.number(),
    acceptedAt: v.optional(v.number()),
    /** clerkId of the account that redeemed it. */
    acceptedBy: v.optional(v.string()),
    revokedAt: v.optional(v.number()),
  })
    .index('by_token', ['token'])
    .index('by_email', ['email']),

  /**
   * Mirror of the Clerk account. The MIRRORED fields (email, name, role,
   * emailVerified) are written by the webhook and never by the client.
   *
   * Two fields are not mirrored and are written by the person themselves
   * through a mutation: `birthDate` (once, via `declareBirthDate`) and
   * `themePreference` (freely, via `setThemePreference`). Neither is
   * security-relevant to Clerk, and neither is ever overwritten by
   * `users.update`.
   *
   * State axis 1: the ACCOUNT. `emailVerified` comes from Clerk.
   */
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    role: vRole,
    /**
     * The roles that count. Optional only for the length of the backfill;
     * `users.backfillRoles` fills it from `role`, and the next schema step
     * makes it required.
     */
    roles: v.optional(v.array(vRole)),
    emailVerified: v.boolean(),
    /**
     * Captured in the age gate, before the Clerk signup.
     *
     * `undefined` means UNKNOWN, not "of legal age". It happens when the
     * account was created without a pre-signup (for example, if the token got
     * lost along the Google path). Those accounts cannot submit a registration
     * until they declare their date; see `users.declareBirthDate`.
     */
    birthDate: v.optional(v.string()), // ISO yyyy-mm-dd
    /** Derived from birthDate at signup time. Never recomputed. */
    wasMinorAtSignup: v.optional(v.boolean()),
    themePreference: v.optional(vThemePreference),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_email', ['email'])
    .index('by_role', ['role']),

  /**
   * State axis 2: GUARDIAN AUTHORIZATION.
   *
   * Hangs off the USER (the guardian authorizes the account, not the form),
   * but carries `cycle` to leave a trail per call for applications. A separate
   * table and not a nested field, so the token can be indexed and the link
   * resolved in O(1).
   *
   * The account IS created without authorization — it stays "in progress".
   * The registration can be submitted, but it gets flagged loudly and is
   * never auto-rejected: a person resolves it.
   */
  guardianAuth: defineTable({
    userId: v.id('users'),
    cycle: v.string(),
    guardianName: v.string(),
    guardianEmail: v.string(),
    /** Single-use token that travels in the email to the guardian. */
    token: v.string(),
    expiresAt: v.number(),
    confirmedAt: v.optional(v.number()),
    /** IP/agent of whoever confirmed, for the consent trail. */
    confirmedFrom: v.optional(v.string()),
    sentAt: v.number(),
    timesSent: v.number(),
  })
    .index('by_token', ['token'])
    .index('by_user_cycle', ['userId', 'cycle'])
    .index('by_cycle_confirmed', ['cycle', 'confirmedAt']),

  /**
   * State axis 3: THE REGISTRATION.
   *
   * Nested arrays (results / rankings / calendar): they are small, they are
   * always read together with the registration, and Convex handles them
   * natively.
   */
  registrations: defineTable({
    userId: v.id('users'),
    cycle: v.string(),

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

    results: v.array(vResult),
    rankings: v.array(vRanking),
    calendar: v.array(vCalendarEvent),

    motivationLetter: v.string(),

    confirmations: v.object({
      rules: v.boolean(),
      scholarshipUnderstood: v.boolean(),
      privacy: v.boolean(),
    }),

    status: vRegistrationStatus,
    submittedAt: v.optional(v.number()),
    updatedAt: v.number(),

    /** Operational validation done by the XUNTAS admins, on the fly. */
    validatedBy: v.optional(v.id('users')),
    validatedAt: v.optional(v.number()),
    validationNote: v.optional(v.string()),
  })
    .index('by_user_cycle', ['userId', 'cycle'])
    .index('by_cycle_status', ['cycle', 'status'])
    .index('by_cycle_branch', ['cycle', 'personal.branch']),
})
