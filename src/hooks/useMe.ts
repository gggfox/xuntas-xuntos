import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/**
 * Roles and permissions of the signed-in account. `undefined` while loading,
 * `null` signed out or before the webhook has inserted the row.
 */
export function useMe() {
  return useQuery(api.users.me)
}
