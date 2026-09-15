import { describe, expect, it } from 'vitest'
import {
  ATTACHMENT_LIMIT,
  IMAGE_MAX_BYTES,
  POST_BODY_LIMIT,
  POST_TITLE_LIMIT,
  PIP_COMMENT_LIMIT,
  VIDEO_MAX_BYTES,
  canDeletePost,
  checkTransition,
  isEmoji,
  monthKeyOf,
  monthRange,
  validateAttachment,
  validateGroupName,
  validatePipComment,
  validatePost,
  youtubeIdFrom,
  zoomLinkIn,
} from '../convex/lib/pipRules'

const ok = {
  kind: 'content' as const,
  title: 'Manejo de la frustración',
  body: '## Este mes\n\nQué hacemos con el error.',
  commentsVisibility: 'lead' as const,
  attachmentCount: 2,
}

describe('validatePost', () => {
  it('accepts a whole post', () => {
    expect(validatePost(ok)).toBeNull()
  })

  it('wants a title within 100', () => {
    expect(validatePost({ ...ok, title: '  ' })).toBe('post_title_required')
    expect(validatePost({ ...ok, title: 'x'.repeat(POST_TITLE_LIMIT + 1) })).toBe('post_title_too_long')
    expect(validatePost({ ...ok, title: 'x'.repeat(POST_TITLE_LIMIT) })).toBeNull()
    expect(POST_TITLE_LIMIT).toBe(100)
  })

  it('wants a body within 10 000', () => {
    expect(validatePost({ ...ok, body: '' })).toBe('post_body_required')
    expect(validatePost({ ...ok, body: 'x'.repeat(POST_BODY_LIMIT + 1) })).toBe('post_body_too_long')
  })

  it('takes at most ten attachments', () => {
    expect(validatePost({ ...ok, attachmentCount: ATTACHMENT_LIMIT })).toBeNull()
    expect(validatePost({ ...ok, attachmentCount: ATTACHMENT_LIMIT + 1 })).toBe('post_attachments_too_many')
  })
})

describe('validatePipComment and validateGroupName', () => {
  it('wants a comment within 2 000', () => {
    expect(validatePipComment('  ')).toBe('comment_required')
    expect(validatePipComment('x'.repeat(PIP_COMMENT_LIMIT + 1))).toBe('comment_too_long')
    expect(validatePipComment('Lo noté en los par 3.')).toBeNull()
  })

  it('wants a group name within 60', () => {
    expect(validateGroupName('')).toBe('group_name_required')
    expect(validateGroupName('x'.repeat(61))).toBe('group_name_too_long')
    expect(validateGroupName('XUNTAS · menores')).toBeNull()
  })
})

describe('canDeletePost', () => {
  it('refuses once anything has been said or felt', () => {
    expect(canDeletePost({ commentCount: 0, reactionCount: 0 })).toBeNull()
    expect(canDeletePost({ commentCount: 1, reactionCount: 0 })).toBe('post_has_activity')
    expect(canDeletePost({ commentCount: 0, reactionCount: 3 })).toBe('post_has_activity')
  })
})

describe('checkTransition', () => {
  const now = Date.parse('2026-09-14T18:00:00.000Z')

  it('lets a draft be scheduled for the future or published now', () => {
    expect(checkTransition('draft', 'scheduled', { scheduledFor: now + 60_000, now })).toBeNull()
    expect(checkTransition('draft', 'scheduled', { scheduledFor: now - 1, now })).toBe('post_schedule_past')
    expect(checkTransition('draft', 'scheduled', { now })).toBe('post_schedule_past')
    expect(checkTransition('draft', 'published', { now })).toBeNull()
  })

  it('lets a scheduled post go back to draft or out now, and nothing else', () => {
    expect(checkTransition('scheduled', 'draft', { now })).toBeNull()
    expect(checkTransition('scheduled', 'published', { now })).toBeNull()
    expect(checkTransition('scheduled', 'unpublished', { now })).toBe('post_status_invalid')
  })

  it('unpublishes only what is published, and republishes only what was unpublished', () => {
    expect(checkTransition('published', 'unpublished', { now })).toBeNull()
    expect(checkTransition('published', 'draft', { now })).toBe('post_status_invalid')
    expect(checkTransition('unpublished', 'published', { now })).toBeNull()
    expect(checkTransition('unpublished', 'scheduled', { scheduledFor: now + 1, now })).toBe('post_status_invalid')
  })
})

describe('isEmoji', () => {
  it('takes one emoji, with skin tones and joiners, and nothing else', () => {
    expect(isEmoji('🔥')).toBe(true)
    expect(isEmoji('👍🏽')).toBe(true)
    expect(isEmoji('🏌️‍♀️')).toBe(true)
    expect(isEmoji('❤️')).toBe(true)
    expect(isEmoji('🔥🔥')).toBe(false)
    expect(isEmoji('a')).toBe(false)
    expect(isEmoji('')).toBe(false)
    expect(isEmoji('<script>')).toBe(false)
  })
})

describe('youtubeIdFrom', () => {
  it('reads the id off the forms people paste', () => {
    for (const u of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
    ]) {
      expect(youtubeIdFrom(u)).toBe('dQw4w9WgXcQ')
    }
    expect(youtubeIdFrom('https://vimeo.com/123')).toBeNull()
    expect(youtubeIdFrom('dQw4w9WgXcQ')).toBeNull()
  })
})

describe('zoomLinkIn', () => {
  it('finds the first zoom.us link in a body', () => {
    expect(zoomLinkIn('Entra por aquí: https://zoom.us/j/000000001 a las 17:00')).toBe('https://zoom.us/j/000000001')
    expect(zoomLinkIn('https://us02web.zoom.us/j/1?pwd=abc)')).toBe('https://us02web.zoom.us/j/1?pwd=abc')
    expect(zoomLinkIn('Sin liga.')).toBeNull()
  })
})

describe('validateAttachment', () => {
  it('wants an 11-character YouTube id', () => {
    expect(validateAttachment({ type: 'youtube', videoId: 'dQw4w9WgXcQ' })).toBeNull()
    expect(validateAttachment({ type: 'youtube', videoId: 'too-short' })).toBe('youtube_id_invalid')
  })

  it('takes only JPG, PNG or WebP for an image, within its size limit', () => {
    expect(validateAttachment({ type: 'image', contentType: 'image/png', size: 1 })).toBeNull()
    expect(validateAttachment({ type: 'image', contentType: 'image/gif', size: 1 })).toBe('attachment_type_invalid')
    expect(validateAttachment({ type: 'image', contentType: null, size: 1 })).toBe('attachment_type_invalid')
    expect(validateAttachment({ type: 'image', contentType: 'image/png', size: IMAGE_MAX_BYTES + 1 })).toBe('attachment_too_large')
  })

  it('takes only MP4 or WebM for a video, within its size limit', () => {
    expect(validateAttachment({ type: 'video', contentType: 'video/mp4', size: 1 })).toBeNull()
    expect(validateAttachment({ type: 'video', contentType: 'video/avi', size: 1 })).toBe('attachment_type_invalid')
    expect(validateAttachment({ type: 'video', contentType: 'video/mp4', size: VIDEO_MAX_BYTES + 1 })).toBe('attachment_too_large')
  })
})

describe('month keys', () => {
  it('names the month in Mexico City, not UTC', () => {
    // 03:00 UTC on the 1st of October is still 21:00 on 30 September in Mexico City.
    expect(monthKeyOf(Date.parse('2026-10-01T03:00:00.000Z'))).toBe('2026-09')
    expect(monthKeyOf(Date.parse('2026-10-01T07:00:00.000Z'))).toBe('2026-10')
  })

  it('turns a key back into a half-open range of ms', () => {
    const r = monthRange('2026-09')!
    expect(monthKeyOf(r.from)).toBe('2026-09')
    expect(monthKeyOf(r.to - 1)).toBe('2026-09')
    expect(monthKeyOf(r.to)).toBe('2026-10')
    expect(monthRange('septiembre')).toBeNull()
    expect(monthRange('2026-13')).toBeNull()
  })
})
