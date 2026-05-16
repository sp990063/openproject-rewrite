export const dynamic = 'force-dynamic'
/**
 * Getting Started Guide
 * Simple steps to help new users get started with OpenProject
 */
import React from 'react'
import Head from 'next/head'
import Link from 'next/link'

export default function GettingStartedPage() {
  const steps = [
    {
      number: 1,
      title: 'Create or Join a Project',
      description: 'Projects are where your work happens. Create a new project or ask an administrator to add you to an existing one.',
      link: '/projects',
      linkText: 'Browse Projects',
    },
    {
      number: 2,
      title: 'Set Up Your Profile',
      description: 'Add your name, avatar, and preferences to help your team recognize you.',
      link: '/my-page',
      linkText: 'Go to My Page',
    },
    {
      number: 3,
      title: 'Create Work Packages',
      description: 'Break down your work into tasks, bugs, features, or milestones. Assign them to team members and set due dates.',
      link: null,
      linkText: null,
    },
    {
      number: 4,
      title: 'Track Time',
      description: 'Log time entries against work packages to keep track of how long tasks take.',
      link: null,
      linkText: null,
    },
    {
      number: 5,
      title: 'Collaborate with Your Team',
      description: 'Use forums for discussions, wikis for documentation, and meetings for synchronous collaboration.',
      link: null,
      linkText: null,
    },
  ]

  return (
    <>
      <Head>
        <title>Getting Started - Help - OpenProject</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-8">
            <Link href="/help" className="text-blue-600 hover:text-blue-800 text-sm">
              ← Back to Help Center
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mt-4">Getting Started</h1>
            <p className="mt-2 text-gray-600">
              Welcome to OpenProject! Follow these steps to get up and running.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-6">
            {steps.map(step => (
              <div key={step.number} className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    {step.number}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-gray-900">{step.title}</h2>
                    <p className="mt-1 text-gray-500">{step.description}</p>
                    {step.link && (
                      <Link href={step.link} className="mt-3 inline-block text-blue-600 hover:text-blue-800 text-sm font-medium">
                        {step.linkText} →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tips Section */}
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Pro Tips</h2>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
              <ul className="space-y-3 text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="font-medium">Keyboard Shortcuts:</span>
                  <span>Press <kbd className="px-1.5 py-0.5 bg-white border border-blue-300 rounded text-xs font-mono">?</kbd> to see available shortcuts.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium">Quick Search:</span>
                  <span>Use the search bar to quickly find projects, work packages, or people.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium">Notifications:</span>
                  <span>Check your notification bell for updates on work packages you're watching.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium">Dashboard:</span>
                  <span>Your dashboard shows an overview of your projects, recent activity, and upcoming deadlines.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Need More Help */}
          <div className="mt-12 text-center">
            <p className="text-gray-500">
              Need more help?{' '}
              <Link href="/help" className="text-blue-600 hover:text-blue-800">
                Explore the Help Center
              </Link>
              {' '}or check out the keyboard shortcuts guide.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
