import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { targetFor } from '../../../convex/lib/notificationRules'
import type { NotificationView } from '../Notifications/NotificationItem'
import NotificationBell from './NotificationBell'

/**
 * The bell, wired: the count and the latest rows from Convex, a press
 * marks the row read and goes where it points. Opening what a notification
 * is about is what reading it means, so the two happen together.
 */
export default function NotificationsMenu() {
  const unread = useQuery(api.notifications.unreadCount) ?? 0
  const latest = useQuery(api.notifications.latest)
  const markRead = useMutation(api.notifications.markRead)
  const markAllRead = useMutation(api.notifications.markAllRead)
  const navigate = useNavigate()

  function open(n: NotificationView) {
    void markRead({ id: n._id as Id<'notifications'> })
    const t = targetFor(n)
    // The target is one of three routes this file knows by name; the
    // router's typed `to` cannot be handed a computed string, so it is
    // cast once here rather than switched over three times.
    void navigate({ to: t.to as '/perfil', params: t.params, search: t.search } as never)
  }

  return (
    <NotificationBell
      unread={unread}
      latest={latest}
      onOpen={open}
      onMarkAll={() => void markAllRead()}
      onSeeAll={() => void navigate({ to: '/notificaciones' })}
    />
  )
}
