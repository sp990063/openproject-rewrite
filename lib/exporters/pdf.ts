import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export type ExportFormat = 'csv' | 'xlsx' | 'pdf'

export interface ExportOption {
  format: ExportFormat
  label: string
  icon: string
  description: string
}

export const EXPORT_OPTIONS: ExportOption[] = [
  {
    format: 'csv',
    label: 'CSV',
    icon: '📊',
    description: 'Comma-separated values for spreadsheet import',
  },
  {
    format: 'xlsx',
    label: 'Excel',
    icon: '📗',
    description: 'Microsoft Excel workbook (.xlsx)',
  },
  {
    format: 'pdf',
    label: 'PDF',
    icon: '📄',
    description: 'Portable document format for printing/sharing',
  },
]

/**
 * Captures a DOM element and converts it to a PDF using html2canvas + jsPDF
 */
export async function elementToPDF(
  element: HTMLElement,
  options: {
    filename?: string
    margin?: number
    scale?: number
    title?: string
  } = {}
): Promise<void> {
  const { margin = 10, scale = 2, title } = options

  // Capture the element as a canvas
  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  })

  const imgData = canvas.toDataURL('image/png')

  // Calculate PDF dimensions
  const pdfWidth = canvas.width / scale
  const pdfHeight = canvas.height / scale

  // Create PDF with appropriate orientation
  const orientation = pdfWidth > pdfHeight ? 'landscape' : 'portrait'
  const pdf = new jsPDF(orientation, 'mm', [pdfWidth / 10, pdfHeight / 10])

  // Add title if provided
  if (title) {
    pdf.setFontSize(16)
    pdf.text(title, margin, margin + 5)
  }

  // Add the canvas image to the PDF
  const contentWidth = (pdfWidth / 10) - (margin * 2)
  const contentHeight = (pdfHeight / 10) - (margin * 2) - (title ? 10 : 0)

  pdf.addImage(imgData, 'PNG', margin, margin + (title ? 10 : 0), contentWidth, contentHeight)

  pdf.save(`${options.filename || 'export'}.pdf`)
}

/**
 * Generates a simple PDF from raw data (for work packages, time entries, etc.)
 */
export function generateDataPDF(
  data: Record<string, unknown>[],
  columns: { key: string; header: string; width?: number }[],
  options: {
    filename?: string
    title?: string
    orientation?: 'portrait' | 'landscape'
  } = {}
): void {
  const { title, orientation = 'portrait', filename = 'export' } = options

  const pdf = new jsPDF(orientation, 'mm', 'a4')

  // Add title
  if (title) {
    pdf.setFontSize(18)
    pdf.setFont('helvetica', 'bold')
    pdf.text(title, 14, 15)
  }

  // Add timestamp
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, title ? 22 : 15)

  // Table header
  let y = title ? 30 : 20
  const colWidth = (190 - (columns.length * 2)) / columns.length

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setFillColor(240, 240, 240)

  // Draw header row
  pdf.rect(10, y - 4, 190, 8, 'F')
  columns.forEach((col, i) => {
    pdf.text(col.header, 12 + i * (colWidth + 2), y)
  })

  y += 8
  pdf.setFont('helvetica', 'normal')

  // Draw data rows
  data.forEach((row, rowIndex) => {
    if (y > 280) {
      pdf.addPage()
      y = 20
    }

    columns.forEach((col, i) => {
      const value = row[col.key] != null ? String(row[col.key]) : ''
      const cellText = value.length > 30 ? value.substring(0, 27) + '...' : value
      pdf.text(cellText, 12 + i * (colWidth + 2), y + (rowIndex % 2) * 6)
    })
    y += 6
  })

  pdf.save(`${filename}.pdf`)
}

/**
 * Creates a printable wiki page content string
 */
export function createWikiPDFContent(
  page: {
    title: string
    content: string
    author?: { name: string } | null
    updatedAt: Date | string
    version: number
  },
  renderedHtml: string
): { title: string; content: string; meta: string } {
  return {
    title: page.title,
    content: renderedHtml,
    meta: `By ${page.author?.name ?? 'Unknown'} | Version ${page.version} | Updated ${new Date(page.updatedAt).toLocaleDateString()}`,
  }
}
