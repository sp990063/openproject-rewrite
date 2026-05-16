import React from 'react'
import { useWatchWorkPackage } from '@/hooks/useWatchWorkPackage'

interface WatchButtonProps {
  workPackageId: string
}

export function WatchButton({ workPackageId }: WatchButtonProps) {
  const { isWatching, count, isLoading, isToggling, toggle } = useWatchWorkPackage(workPackageId)

  return (
    <button
      onClick={toggle}
      disabled={isLoading || isToggling}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        isWatching
          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 focus:ring-blue-500'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 focus:ring-gray-500'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={isWatching ? 'Stop watching this work package' : 'Watch this work package'}
    >
      {isWatching ? <EyeOffIcon /> : <EyeIcon />}
      <span>{isToggling ? '...' : count}</span>
    </button>
  )
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
