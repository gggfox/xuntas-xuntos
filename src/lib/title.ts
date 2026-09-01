import { useEffect } from 'react'
import * as m from '../paraglide/messages.js'

/**
 * Tab title for the screens that are not routes.
 *
 * Every route sets its title through `head`, but the 404 and the error screen
 * are the router's fallbacks: they have no route of their own, so the tab
 * would keep the title of whatever page the person was trying to reach. On
 * the server that is still what gets sent — this only corrects it once the
 * page is interactive, which is soon enough for a dead end.
 *
 * The cleanup restores the previous title on the way out. `HeadContent` only
 * touches the tag when the new title differs from the one it rendered last,
 * and it rendered the root title while this screen was up; without the
 * restore, walking from the 404 back home would leave "this page does not
 * exist" in the tab.
 *
 * Why an effect: `document.title` is an external system, not derived state,
 * and the write has to be undone on the way out. Neither the write nor the
 * restore can happen while rendering.
 * See `.agents/skills/vercel-react-best-practices/rules/rerender-derived-state-no-effect.md`.
 */
export function useDocumentTitle(page: string) {
  useEffect(() => {
    const previous = document.title
    document.title = m.meta_page({ page })
    return () => {
      document.title = previous
    }
  }, [page])
}
