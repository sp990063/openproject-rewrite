/**
 * Excel export using XLSX library
 * Phase G2 - Export System
 */
import * as XLSX from 'xlsx'

export function generateWorkPackageExcel(workPackages: any[]): ArrayBuffer {
  const data = workPackages.map(wp => ({
    ID: wp.id,
    Subject: wp.subject,
    Status: wp.status?.name || '',
    Type: wp.type?.name || '',
    Assignee: wp.assignee?.name || '',
    Priority: wp.priority?.name || '',
    'Due Date': wp.dueDate || '',
    'Estimated Hours': wp.estimatedHours || '',
    'Spent Hours': wp.spentHours || '',
    Description: wp.description || '',
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Work Packages')
  
  // Auto-size columns
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, 15)
  }))
  worksheet['!cols'] = colWidths

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as unknown as ArrayBuffer
}
