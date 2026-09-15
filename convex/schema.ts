import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/** Program branch. XUNTAS = women's, XUNTOS = men's. */
export const vBranch = v.union(v.literal('womens'), v.literal('mens'))

/**
 * Account roles. Owned by Convex — see docs/DECISIONS.md, "Convex owns roles".
 */
export const vRole = v.union(
  v.literal('athlete'),
  v.literal('admin'),
  v.literal('master_admin'),
  v.literal('coach'),
  v.literal('finance'),
  v.literal('health'),
  v.literal('pip_lead'),
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
  v.literal('selected'),
  v.literal('not_selected'),
  /** A member let go from the program after selection. Membership = `selected`; this is its end. */
  v.literal('removed'),
)

/** The decisions administration and the Council may record, as opposed to the states a draft passes through on its own. */
export const vDecision = v.union(
  v.literal('validated'),
  v.literal('rejected'),
  v.literal('selected'),
  v.literal('not_selected'),
  v.literal('removed'),
)

const vNoticeDecision = v.union(
  v.literal('rejected'),
  v.literal('selected'),
  v.literal('not_selected'),
  v.literal('removed'),
)
const vNoticeStatus = v.union(
  v.literal('not_sent'),
  v.literal('sent'),
  v.literal('delivered'),
  v.literal('bounced'),
)

export const vPostKind = v.union(v.literal('content'), v.literal('session'), v.literal('challenge'))
export const vPostStatus = v.union(
  v.literal('draft'),
  v.literal('scheduled'),
  v.literal('published'),
  v.literal('unpublished'),
)
export const vCommentsVisibility = v.union(v.literal('off'), v.literal('lead'), v.literal('group'))
/** One attachment. A stored file keeps its name for the caption; a YouTube video keeps only its id, and the flag the attach-time check set. */
export const vAttachment = v.union(
  v.object({ type: v.literal('image'), storageId: v.id('_storage'), name: v.string() }),
  v.object({ type: v.literal('video'), storageId: v.id('_storage'), name: v.string() }),
  v.object({ type: v.literal('youtube'), videoId: v.string(), unavailable: v.optional(v.boolean()) }),
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

const vCycleFields = v.object({
  title: v.string(),
  opensOn: v.string(),
  closesOn: v.string(),
  reviewOn: v.string(),
  isActive: v.boolean(),
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
   * One row per call for applications; exactly one is active. Dates are
   * Mexico City days — see convex/lib/cycleRules.ts for how they become
   * instants.
   *
   * A call has no name: the row's own `_id` is the key every registration
   * and guardian authorization is filed under, minted by Convex at creation
   * and never typed. `title` is the only thing an admin types — the free
   * text families actually read, on the site and in emails, editable any
   * time because a renamed call is still the same call.
   */
  cycles: defineTable({
    title: v.string(),
    opensOn: v.string(),
    closesOn: v.string(),
    reviewOn: v.string(),
    isActive: v.boolean(),
    /** Optional only so the seed can run before any staff row exists. */
    createdBy: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_active', ['isActive']),

  /**
   * Who moved the window, when, from what to what. The dates decide whether
   * a family's registration gets in; changing them leaves a trail.
   */
  cycleChanges: defineTable({
    cycle: v.id('cycles'),
    changedBy: v.id('users'),
    changedAt: v.number(),
    before: v.union(v.null(), vCycleFields),
    after: vCycleFields,
  }).index('by_cycle', ['cycle']),

  /**
   * Mirror of the Clerk account. The MIRRORED fields (email, name,
   * emailVerified) are written by the webhook and never by the client.
   * `roles` is not mirrored — see its own comment below.
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
    /**
     * LEGACY. The Clerk-mirrored single role, superseded by `roles`. Kept
     * optional so a deployment whose rows still carry it accepts the schema;
     * `users.dropLegacyRole` unsets it after `backfillRoles` has run, and the
     * field leaves the schema in a later PR once no row has it.
     */
    role: v.optional(vRole),
    /**
     * Owned by Convex, never by Clerk. Written by exactly three paths:
     * `staff.grantRoles` (CLI bootstrap), the invite redeemed in
     * `users.create`, and `staff.setRoles`. See convex/lib/permissions.ts
     * for what each role may do.
     */
    roles: v.array(vRole),
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
    .index('by_email', ['email']),

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
    cycle: v.id('cycles'),
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
    cycle: v.id('cycles'),

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

    /** Every decision ever made on this registration, newest last. */
    decisionLog: v.optional(
      v.array(
        v.object({
          status: vDecision,
          by: v.id('users'),
          at: v.number(),
          note: v.optional(v.string()),
        }),
      ),
    ),
    /**
     * The email that tells the athlete. `not_sent` until someone presses the
     * button; then the Resend webhook moves it to delivered or bounced. A
     * decision whose notice went out is locked — see decisionRules.ts.
     */
    decisionNotice: v.optional(
      v.object({
        decision: vNoticeDecision,
        status: vNoticeStatus,
        emailId: v.optional(v.string()),
        sentAt: v.optional(v.number()),
        sentBy: v.optional(v.id('users')),
      }),
    ),
    /** Age at the cycle's opening day. Written by the first save in a cycle (see users.wasMinorAtSignup for the frozen signup value). */
    wasMinorAtCycleStart: v.optional(v.boolean()),
  })
    .index('by_user_cycle', ['userId', 'cycle'])
    .index('by_cycle_status', ['cycle', 'status'])
    .index('by_cycle_branch', ['cycle', 'personal.branch'])
    .index('by_notice_email', ['decisionNotice.emailId'])
    /**
     * Membership. "Is this person in the program" is "does any registration
     * of theirs read `selected`", and "who is in the program" is the same
     * question without the person — one index answers both.
     */
    .index('by_status_user', ['status', 'userId']),

  /**
   * Who works with whom. A coach or a health specialist reads and comments
   * on the journals of the members assigned to them, and nobody else's.
   * Open-ended, not per cycle: a row ends (`endedAt`) when administration
   * says so or when the member is removed, and the row stays so a comment
   * written under it keeps its context.
   */
  assignments: defineTable({
    staffUserId: v.id('users'),
    athleteUserId: v.id('users'),
    assignedBy: v.id('users'),
    assignedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index('by_staff_active', ['staffUserId', 'endedAt'])
    .index('by_athlete_active', ['athleteUserId', 'endedAt'])
    .index('by_staff_athlete', ['staffUserId', 'athleteUserId']),

  /**
   * The bitácora. One entry per tournament or training session, dated by
   * the athlete (the day it happened, not the day it was written). Every
   * entry is visible to whoever may read the athlete — there is no private
   * flag, by decision. `commentCount` is kept here so the feed can say
   * "3 comentarios" without a second query per card, and so deletion can
   * refuse without one either.
   */
  journalEntries: defineTable({
    athleteUserId: v.id('users'),
    kind: v.union(v.literal('tournament'), v.literal('training')),
    title: v.string(),
    /** ISO day. Sorts as a string, which is what the index relies on. */
    date: v.string(),
    body: v.string(),
    score: v.optional(v.string()),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
    commentCount: v.number(),
  }).index('by_athlete_date', ['athleteUserId', 'date']),

  /**
   * Words under an entry, or — with no `entryId` — in the athlete's general
   * stream. One table, one index: the general stream is the thread whose
   * entry is `undefined`.
   */
  journalComments: defineTable({
    athleteUserId: v.id('users'),
    entryId: v.optional(v.id('journalEntries')),
    authorId: v.id('users'),
    body: v.string(),
    createdAt: v.number(),
  }).index('by_athlete_entry', ['athleteUserId', 'entryId']),

  /** What the staff list shows per member, kept by the entry mutations so the list is one read per row. */
  journalStats: defineTable({
    athleteUserId: v.id('users'),
    entryCount: v.number(),
    lastEntryDate: v.optional(v.string()),
  }).index('by_athlete', ['athleteUserId']),

  /**
   * In-app only. A row per recipient per event; `readAt` absent until
   * opened. `by_read` serves the cron that prunes read rows — `undefined`
   * sorts below every number, so a range from 0 skips the unread.
   */
  notifications: defineTable({
    userId: v.id('users'),
    kind: v.union(
      v.literal('entry_comment'),
      v.literal('entry_reply'),
      v.literal('general_comment'),
      v.literal('general_reply'),
      v.literal('entry_created'),
      v.literal('assignment_created'),
      v.literal('assignment_ended'),
      v.literal('pip_post_published'),
      v.literal('pip_comment_reply'),
      v.literal('pip_comment_new'),
    ),
    actorId: v.id('users'),
    /** Absent on PIP rows, which are about a post rather than a person. */
    athleteId: v.optional(v.id('users')),
    entryId: v.optional(v.id('journalEntries')),
    commentId: v.optional(v.id('journalComments')),
    postId: v.optional(v.id('pipPosts')),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_user_unread', ['userId', 'readAt'])
    .index('by_read', ['readAt']),

  /**
   * The PIP — see docs/superpowers/specs/2026-09-14-pip-posts-groups-design.md.
   *
   * A group is the lead's word for "who gets this". Renamed and archived,
   * never deleted, so an old post still says who it went to. "Todos los
   * miembros" is not a row: a post with no `groupIds` reaches every member.
   */
  pipGroups: defineTable({
    name: v.string(),
    createdBy: v.id('users'),
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
  }).index('by_archived', ['archivedAt']),

  /** Membership rows are ended, never deleted — the same as assignments. */
  pipGroupMembers: defineTable({
    groupId: v.id('pipGroups'),
    athleteUserId: v.id('users'),
    addedBy: v.id('users'),
    addedAt: v.number(),
    removedAt: v.optional(v.number()),
  })
    .index('by_group_active', ['groupId', 'removedAt'])
    .index('by_athlete_active', ['athleteUserId', 'removedAt']),

  /**
   * One shape of post. `kind` changes an icon and an eyebrow, nothing else.
   * `groupIds` empty means everyone. Visibility is computed at read time
   * from current membership, never fanned out. `commentCount` and
   * `reactionCount` are kept by the mutations so the feed says "3
   * comentarios" without a query per card, and delete can refuse without
   * one either.
   */
  pipPosts: defineTable({
    authorId: v.id('users'),
    kind: vPostKind,
    title: v.string(),
    /** Markdown, the subset in the spec §7. */
    body: v.string(),
    attachments: v.array(vAttachment),
    groupIds: v.array(v.id('pipGroups')),
    commentsVisibility: vCommentsVisibility,
    status: vPostStatus,
    scheduledFor: v.optional(v.number()),
    /** The release job, so a rescheduling can cancel it. */
    scheduledJobId: v.optional(v.id('_scheduled_functions')),
    publishedAt: v.optional(v.number()),
    editedAt: v.optional(v.number()),
    unpublishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    commentCount: v.number(),
    reactionCount: v.number(),
  })
    .index('by_status_published', ['status', 'publishedAt'])
    .index('by_status_scheduled', ['status', 'scheduledFor']),

  /**
   * One level: a comment, and replies to it (`parentId`). `visibility` is
   * copied from the post at write time and never follows a later change.
   * A hidden comment stays, for its author (marked) and for leads.
   */
  pipComments: defineTable({
    postId: v.id('pipPosts'),
    parentId: v.optional(v.id('pipComments')),
    authorId: v.id('users'),
    body: v.string(),
    visibility: v.union(v.literal('lead'), v.literal('group')),
    hiddenAt: v.optional(v.number()),
    hiddenBy: v.optional(v.id('users')),
    createdAt: v.number(),
    replyCount: v.number(),
  }).index('by_post_parent', ['postId', 'parentId']),

  /** Any emoji, several per member, on a post or a top-level comment. One row per (target, user, emoji). */
  pipReactions: defineTable({
    targetKind: v.union(v.literal('post'), v.literal('comment')),
    targetId: v.union(v.id('pipPosts'), v.id('pipComments')),
    userId: v.id('users'),
    emoji: v.string(),
    createdAt: v.number(),
  })
    .index('by_target', ['targetKind', 'targetId'])
    .index('by_target_user', ['targetKind', 'targetId', 'userId']),
})
