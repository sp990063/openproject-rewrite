'use client'

import React from 'react'
import { MACRO_DEFINITIONS, type MacroDefinition } from '@/lib/wiki/macros'

interface WikiMacrosHelpProps {
  className?: string
}

function MacroItem({ macro }: { macro: MacroDefinition }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <code className="text-sm font-medium text-blue-600">{macro.syntax}</code>
      <p className="text-sm text-gray-600 mt-1">{macro.description}</p>
      <p className="text-xs text-gray-400 mt-1">
        Example: <code>{macro.example}</code>
      </p>
    </div>
  )
}

export function WikiMacrosHelp({ className = '' }: WikiMacrosHelpProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Wiki Macros</h3>
      <p className="text-sm text-gray-500 mb-4">
        Use special macros in your wiki pages to embed dynamic content.
      </p>
      <div className="space-y-3">
        {MACRO_DEFINITIONS.map((macro) => (
          <MacroItem key={macro.name} macro={macro} />
        ))}
      </div>
    </div>
  )
}
