/**
 * OpenProject API v3 Response Formatter
 * Formats responses in OpenProject API v3 style
 */

/**
 * Standard v3 list envelope for collections
 */
export function v3ListResponse<T>(
  data: T[],
  total: number,
  offset: number = 1,
  pageSize: number = 20
): Record<string, unknown> {
  return {
    _type: 'Collection',
    count: data.length,
    total,
    offset,
    pageSize,
    groups: [],
    _embedded: {
      elements: data,
    },
    _links: {
      self: {
        href: `/api/v3?offset=${offset}&pageSize=${pageSize}`,
      },
    },
  }
}

/**
 * Standard v3 single resource envelope
 */
export function v3SingleResponse<T extends Record<string, unknown>>(
  data: T,
  type: string = 'Result'
): Record<string, unknown> {
  const dataLinks = data._links as { self?: { href?: string } } | undefined
  return {
    _type: type,
    _embedded: data,
    _links: {
      self: {
        href: dataLinks?.self?.href || (data.id as string),
      },
    },
    ...data,
  }
}

/**
 * Standard v3 error format
 */
export function v3Error(
  code: string,
  message: string,
  details?: unknown
): Record<string, unknown> {
  const error: Record<string, unknown> = {
    _type: 'Error',
    errorIdentifier: {
      code,
      message,
    },
    _embedded: {
      details,
    },
    _links: {
      self: {
        href: '/api/v3/errors',
      },
    },
  }

  return error
}

/**
 * Format a v3 work package to include _links for status, type, priority, etc.
 */
export function formatWorkPackageLinks(id: string, projectId: string) {
  return {
    _links: {
      self: {
        href: `/api/v3/work-packages/${id}`,
      },
      project: {
        href: `/api/v3/projects/${projectId}`,
      },
    },
  }
}

/**
 * Format a user for v3 API
 */
export function formatUserV3(user: {
  id: string
  name: string
  email: string
  avatarUrl?: string | null
}): Record<string, unknown> {
  return {
    _type: 'User',
    id: user.id,
    name: user.name,
    _links: {
      self: {
        href: `/api/v3/users/${user.id}`,
      },
      showUser: {
        href: `/users/${user.id}`,
      },
    },
    ...(user.avatarUrl && { avatarUrl: user.avatarUrl }),
  }
}
