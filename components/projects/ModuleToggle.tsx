import React from 'react'
import type { ModuleType } from '@/types/project'

interface ModuleToggleProps {
  module: {
    module: ModuleType
    enabled: boolean
  }
  onToggle: (module: ModuleType) => void
  disabled?: boolean
}

const MODULE_LABELS: Record<ModuleType, string> = {
  work_packages: 'Work Packages',
  gantt: 'Gantt Chart',
  board: 'Board',
  calendar: 'Calendar',
  wiki: 'Wiki',
  forums: 'Forums',
  documents: 'Documents',
  meetings: 'Meetings',
  time_tracking: 'Time Tracking',
}

export function ModuleToggle({ module, onToggle, disabled }: ModuleToggleProps) {
  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
      <div>
        <p className="font-medium text-gray-900">
          {MODULE_LABELS[module.module] || module.module}
        </p>
        <p className="text-sm text-gray-500">{module.module}</p>
      </div>
      <button
        type="button"
        onClick={() => onToggle(module.module)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          module.enabled ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            module.enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}