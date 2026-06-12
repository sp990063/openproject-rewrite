// frontend/test/unit/router.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { matchPath, parseQuery } from '../../router.js'

describe('router matchPath', () => {
  it('matches static paths', () => {
    expect(matchPath('/dashboard', '/dashboard')).toEqual({})
  })

  it('extracts :param values', () => {
    expect(matchPath('/projects/:id', '/projects/abc-123')).toEqual({ id: 'abc-123' })
  })

  it('extracts multiple :params', () => {
    expect(matchPath('/projects/:pid/work-packages/:wid', '/projects/p1/work-packages/w2'))
      .toEqual({ pid: 'p1', wid: 'w2' })
  })

  it('returns null for length mismatch', () => {
    expect(matchPath('/projects/:id', '/projects/abc/extra')).toBeNull()
  })

  it('returns null for static segment mismatch', () => {
    expect(matchPath('/projects/:id', '/users/abc')).toBeNull()
  })

  it('decodes URI-encoded params', () => {
    expect(matchPath('/wiki/:slug', '/wiki/hello%20world')).toEqual({ slug: 'hello world' })
  })
})

describe('parseQuery', () => {
  it('returns empty object for empty string', () => {
    expect(parseQuery('')).toEqual({})
  })
  it('parses simple kv pairs', () => {
    expect(parseQuery('a=1&b=2')).toEqual({ a: '1', b: '2' })
  })
  it('first value wins on duplicate keys', () => {
    expect(parseQuery('a=1&a=2')).toEqual({ a: '1' })
  })
})
