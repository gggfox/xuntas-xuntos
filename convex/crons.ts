import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

/**
 * Pre-signups nobody used carry the birth date of a possibly underage person
 * and their guardian's email. They expire after two hours; this deletes them.
 * Every hour is enough: there is no rush, but they do not pile up either.
 */
crons.interval('delete expired pre-signups', { hours: 1 }, internal.preSignups.cleanup, {})

export default crons
