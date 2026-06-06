// hooks/useUrlState.ts
// Thin re-exports from nuqs + a typed wrapper hook for the work-packages page.
// Keep this file additive and minimal — it is the project's URL-state seam.
import {
  useQueryState,
  useQueryStates,
  parseAsString,
  parseAsInteger,
  parseAsBoolean,
  parseAsStringLiteral,
  parseAsArrayOf,
} from 'nuqs'

/**
 * Allowed values for the `view` URL parameter on the work-packages page.
 * Mirrors the OpenProject view switcher (table | board | gantt | calendar).
 */
export const WORK_PACKAGE_VIEW_VALUES = ['table', 'board', 'gantt', 'calendar'] as const
export type WorkPackageView = (typeof WORK_PACKAGE_VIEW_VALUES)[number]

export {
  useQueryState,
  useQueryStates,
  parseAsString,
  parseAsInteger,
  parseAsBoolean,
  parseAsStringLiteral,
  parseAsArrayOf,
}

/**
 * `useWorkPackagesUrlState` is the typed wrapper used by the work-packages
 * page. It exposes a small, stable shape so callers don't have to re-declare
 * the parsers on every page.
 *
 * URL shape:
 *   ?view=table|board|gantt|calendar
 *   &projectId=<string>
 *   &page=<int>
 *   &status=<csv of strings, e.g. open,in_progress>
 */
export function useWorkPackagesUrlState() {
  const [view, setView] = useQueryState(
    'view',
    parseAsStringLiteral(WORK_PACKAGE_VIEW_VALUES).withDefault('table')
  )
  const [projectId, setProjectId] = useQueryState(
    'projectId',
    parseAsString.withDefault('')
  )
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const [status, setStatus] = useQueryState(
    'status',
    parseAsArrayOf(parseAsString).withDefault([])
  )

  return {
    view,
    setView,
    projectId,
    setProjectId,
    page,
    setPage,
    status,
    setStatus,
  } as const
}
