export const dynamic = 'force-dynamic'
import React, { useState } from 'react'
import { KeyboardShortcutsDialog } from '@/components/common/KeyboardShortcutsDialog'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

export default function ShortcutsPage() {
  const [showDialog, setShowDialog] = useState(false)

  useKeyboardShortcuts({
    onToggleShortcuts: () => setShowDialog((prev) => !prev),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Keyboard Shortcuts</h1>
          <p className="mt-2 text-gray-600">
            Press <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">?</kbd> anytime to open this dialog.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Reference</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Navigation</h3>
              <ul className="space-y-1 text-gray-700">
                <li><kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">g</kbd> then <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">i</kbd> — Go to Inbox</li>
                <li><kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">g</kbd> then <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">p</kbd> — Go to Projects</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Actions</h3>
              <ul className="space-y-1 text-gray-700">
                <li><kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">c</kbd> — Create</li>
                <li><kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">e</kbd> — Edit</li>
                <li><kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">s</kbd> — Save</li>
                <li><kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Esc</kbd> — Close</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Work Packages</h3>
              <ul className="space-y-1 text-gray-700">
                <li><kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">w</kbd> — Work packages</li>
                <li><kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">b</kbd> — Board view</li>
              </ul>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowDialog(true)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Open Shortcuts Dialog
        </button>

        <KeyboardShortcutsDialog open={showDialog} onOpenChange={setShowDialog} />
      </div>
    </div>
  )
}
