import React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ShortcutGroup {
  title: string
  shortcuts: {
    keys: string[]
    description: string
  }[]
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['g', 'i'], description: 'Go to Inbox' },
      { keys: ['g', 'p'], description: 'Go to Projects' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['c'], description: 'Create' },
      { keys: ['e'], description: 'Edit' },
      { keys: ['s'], description: 'Save' },
      { keys: ['Esc'], description: 'Close' },
    ],
  },
  {
    title: 'Work Packages',
    shortcuts: [
      { keys: ['w'], description: 'Work packages' },
      { keys: ['b'], description: 'Board view' },
    ],
  },
]

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]'
          )}
        >
          <DialogPrimitive.Title className="text-xl font-semibold text-gray-900 mb-6">
            Keyboard Shortcuts
          </DialogPrimitive.Title>

          <div className="space-y-6">
            {shortcutGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-gray-700">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono text-gray-800 min-w-[1.5rem] text-center">
                              {key}
                            </kbd>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="text-gray-400 mx-0.5">then</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
