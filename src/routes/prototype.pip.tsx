import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import PrototypeSwitcher from '../components/Pip/prototype/PrototypeSwitcher'
import { ME, SEED, type Comment, type Post } from '../components/Pip/prototype/data'
import { PROTOTYPE_ON, parseVariant, usePrototype, type Variant } from '../components/Pip/prototype/usePrototype'
import { VariantA, VariantB, VariantC, VariantD, VariantE } from '../components/Pip/prototype/Variants'

/*
 * PROTOTYPE — throwaway route. Five variants of the member's PIP feed,
 * switchable via `?variant=a|b|c|d|e`, fake data, state in memory. See
 * components/Pip/prototype/usePrototype.ts for the question. Renders
 * nothing in a production build.
 */
export const Route = createFileRoute('/prototype/pip')({
  head: () => ({ meta: [{ title: 'Prototipo · PIP' }] }),
  validateSearch: (s: Record<string, unknown>): { variant?: Variant } => {
    const v = parseVariant(s.variant)
    return v ? { variant: v } : {}
  },
  component: PrototypePage,
})

function PrototypePage() {
  if (!PROTOTYPE_ON) return null
  return <Feed />
}

function Feed() {
  const variant = usePrototype()
  const [posts, setPosts] = useState<Post[]>(SEED)

  const onReact = useCallback((postId: string, emoji: string) => {
    setPosts((list) =>
      list.map((p) => {
        if (p.id !== postId) return p
        const has = p.reactions.find((r) => r.emoji === emoji)
        const reactions = has
          ? p.reactions
              .map((r) => (r.emoji === emoji ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r))
              .filter((r) => r.count > 0)
          : [...p.reactions, { emoji, count: 1, mine: true }]
        return { ...p, reactions }
      }),
    )
  }, [])

  const onComment = useCallback((postId: string, body: string, parentId?: string) => {
    setPosts((list) =>
      list.map((p) => {
        if (p.id !== postId) return p
        const c: Comment = { id: `n${Date.now()}`, author: ME, body, at: new Date().toISOString(), visibility: p.commentsVisibility === 'group' ? 'group' : 'lead', replies: [] }
        const comments = parentId
          ? p.comments.map((x) => (x.id === parentId ? { ...x, replies: [...x.replies, c] } : x))
          : [...p.comments, c]
        return { ...p, comments }
      }),
    )
  }, [])

  const props = { posts, onReact, onComment }
  return (
    <>
      {variant === 'a' && <VariantA {...props} />}
      {variant === 'b' && <VariantB {...props} />}
      {variant === 'c' && <VariantC {...props} />}
      {variant === 'd' && <VariantD {...props} />}
      {variant === 'e' && <VariantE {...props} />}
      <PrototypeSwitcher />
    </>
  )
}
