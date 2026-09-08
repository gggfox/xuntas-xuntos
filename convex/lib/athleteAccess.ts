import type { Permission } from './permissions'

/**
 * Who may look at a member, and who may write in their journal. Pure, so
 * the same table decides on the server (the gate) and in the browser (what
 * to draw). `members.ts` works the four facts out from the database and
 * hands them here.
 */
export type AthleteAccess = {
  permissions: readonly Permission[]
  /** The actor is the athlete. */
  isSelf: boolean
  /** The actor holds an active assignment to the athlete. */
  isAssigned: boolean
  /** The athlete is in the program right now (`selected`, not `removed`). */
  isMember: boolean
}

/**
 * Reading. Administration sees every member and every removed member's
 * frozen journal. Assigned staff see their assigned members. The athlete
 * sees their own journal while they are a member — after removal it stays
 * on record, for administration only.
 */
export function canReadAthlete(a: AthleteAccess): boolean {
  if (a.permissions.includes('view_all_athletes')) return true
  if (a.permissions.includes('view_assigned_athletes') && a.isAssigned) return true
  return a.isSelf && a.isMember
}

/** Writing entries: the athlete alone, while a member. */
export function canWriteEntries(a: Pick<AthleteAccess, 'isSelf' | 'isMember'>): boolean {
  return a.isSelf && a.isMember
}

/**
 * Commenting: anyone who can read the journal and holds `comment_journal`,
 * plus the athlete on their own — but only while the journal is alive. A
 * removed member's journal takes no more words from anyone.
 */
export function canCommentOn(a: AthleteAccess): boolean {
  if (!a.isMember) return false
  if (a.isSelf) return true
  return a.permissions.includes('comment_journal') && canReadAthlete(a)
}
