/**
 * CSV export for work packages
 * Phase G2 - Export System
 */

/**
 * Converts a value to CSV-safe string
 */
function toCSVField(value: any): string {
  if (value === null || value === undefined) {
    return ''
  }
  const str = String(value)
  // Escape quotes and wrap in quotes if contains comma, newline, or quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Generates CSV string from work packages array
 */
export function generateWorkPackageCSV(workPackages: any[]): string {
  const headers = [
    'ID',
    'Subject',
    'Status',
    'Type',
    'Assignee',
    'Priority',
    'Due Date',
    'Estimated Hours',
    'Spent Hours',
    'Description',
  ]

  const rows = workPackages.map(wp => [
    wp.id,
    wp.subject,
    wp.status?.name || '',
    wp.type?.name || '',
    wp.assignee?.name || '',
    wp.priority?.name || '',
    wp.dueDate || '',
    wp.estimatedHours || '',
    wp.spentHours || '',
    wp.description || '',
  ])

  const csvLines = [
    headers.join(','),
    ...rows.map(row => row.map(field => toCSVField(field)).join(',')),
  ]

  return csvLines.join('\n')
}