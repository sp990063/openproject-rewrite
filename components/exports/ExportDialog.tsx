import React, { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { ExportFormat } from '@/lib/exporters/pdf'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport: (format: ExportFormat) => void
  title?: string
  description?: string
  isLoading?: boolean
}

const EXPORT_FORMATS: { format: ExportFormat; label: string; icon: string; description: string }[] = [
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

export function ExportDialog({
  open,
  onOpenChange,
  onExport,
  title = 'Export Data',
  description = 'Choose a format to export your data.',
  isLoading = false,
}: ExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null)

  const handleExport = () => {
    if (selectedFormat) {
      onExport(selectedFormat)
      onOpenChange(false)
      setSelectedFormat(null)
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="space-y-3">
        {EXPORT_FORMATS.map((option) => (
          <button
            key={option.format}
            onClick={() => setSelectedFormat(option.format)}
            className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-colors text-left ${
              selectedFormat === option.format
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className="text-2xl">{option.icon}</span>
            <div className="flex-1">
              <div className="font-medium text-gray-900">{option.label}</div>
              <div className="text-sm text-gray-500">{option.description}</div>
            </div>
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                selectedFormat === option.format
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-gray-300'
              }`}
            >
              {selectedFormat === option.format && (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                  <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleExport}
          disabled={!selectedFormat}
          isLoading={isLoading}
        >
          Export
        </Button>
      </div>
    </Modal>
  )
}
