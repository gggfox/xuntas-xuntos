import { Show } from '@clerk/tanstack-react-start'
import { Navigate, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, usePaginatedQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import * as m from '../paraglide/messages.js'
import { canReceiveNotifications, targetFor } from '../../convex/lib/notificationRules'
import NotificationItem, { type NotificationView } from '../components/Notifications/NotificationItem'
import { useMe } from '../hooks/useMe'
import { SignedOut } from './perfil'

/** Everything the bell would show, without the ten-row cap. */
export const Route = createFileRoute('/notificaciones')({
  head: () => ({ meta: [{ title: m.meta_page({ page: m.nav_notifications() }) }] }),
  component: NotificationsPage,
})

function NotificationsPage() {
  return (
    <>
      <Show when="signed-out">
        <SignedOut />
      </Show>
      <Show when="signed-in">
        <List />
      </Show>
    </>
  )
}

function List() {
  const me = useMe()
  const navigate = useNavigate()
  const { results, status, loadMore } = usePaginatedQuery(api.notifications.list, {}, { initialNumItems: 50 })
  const markRead = useMutation(api.notifications.markRead)
  const markAllRead = useMutation(api.notifications.markAllRead)

  if (me === undefined) {
    return (
      <main className="col col-720 pt-[38px] pb-[90px]">
        <p className="text-soft">{m.common_loading()}</p>
      </main>
    )
  }
  if (me === null || !canReceiveNotifications(me.roles, me.member)) return <Navigate to="/mi-registro" replace />

  function open(n: NotificationView) {
    void markRead({ id: n._id as Id<'notifications'> })
    const t = targetFor(n)
    void navigate({ to: t.to as '/perfil', params: t.params, search: t.search } as never)
  }

  const unread = results.some((n) => n.readAt === undefined)

  return (
    <main className="col col-720 pt-[38px] pb-[90px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{m.journal_eyebrow()}</p>
          <h1 className="h-display mt-1 text-[clamp(26px,4.6vw,36px)]">{m.nav_notifications()}</h1>
        </div>
        {unread && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void markAllRead()}>
            {m.notif_mark_all()}
          </button>
        )}
      </div>

      <div className="card mt-8 divide-y divide-line overflow-hidden">
        {status === 'LoadingFirstPage' ? (
          <p className="px-[21px] py-[15px] text-[12.5px] text-soft">{m.common_loading()}</p>
        ) : results.length === 0 ? (
          <p className="px-[21px] py-[15px] text-[13.5px] font-light text-soft">{m.notif_none()}</p>
        ) : (
          results.map((n) => <NotificationItem key={n._id} n={n} onOpen={open} />)
        )}
      </div>
      {status === 'CanLoadMore' && (
        <button type="button" className="btn btn-ghost mt-4" onClick={() => loadMore(50)}>
          {m.journal_load_more()}
        </button>
      )}
    </main>
  )
}
