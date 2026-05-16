export const dynamic = 'force-dynamic'
/**
 * Main Help Page
 * Links to various help resources
 */
import React from 'react'
import Head from 'next/head'
import Link from 'next/link'

export default function HelpPage() {
  return (
    <>
      <Head>
        <title>Help - OpenProject</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Help Center</h1>
            <p className="mt-2 text-gray-600">
              Find resources and guidance to help you get the most out of OpenProject.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Getting Started */}
            <Link href="/help/getting-started" className="block group">
              <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 border border-gray-200">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                  Getting Started
                </h2>
                <p className="mt-2 text-gray-500 text-sm">
                  New to OpenProject? Learn the basics and get up and running quickly.
                </p>
              </div>
            </Link>

            {/* Keyboard Shortcuts */}
            <Link href="/help/shortcuts" className="block group">
              <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 border border-gray-200">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                  Keyboard Shortcuts
                </h2>
                <p className="mt-2 text-gray-500 text-sm">
                  Work more efficiently with keyboard shortcuts for common actions.
                </p>
              </div>
            </Link>

            {/* Documentation */}
            <a href="#" className="block group cursor-not-allowed opacity-75">
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Documentation
                </h2>
                <p className="mt-2 text-gray-500 text-sm">
                  Comprehensive documentation coming soon.
                </p>
              </div>
            </a>

            {/* Contact Support */}
            <a href="#" className="block group cursor-not-allowed opacity-75">
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Contact Support
                </h2>
                <p className="mt-2 text-gray-500 text-sm">
                  Need help? Contact support coming soon.
                </p>
              </div>
            </a>
          </div>

          {/* Quick Links Section */}
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Links</h2>
            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <ul className="space-y-3">
                <li>
                  <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                    → Go to Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/projects" className="text-blue-600 hover:text-blue-800">
                    → Browse Projects
                  </Link>
                </li>
                <li>
                  <Link href="/my-page" className="text-blue-600 hover:text-blue-800">
                    → My Page
                  </Link>
                </li>
                <li>
                  <Link href="/notifications" className="text-blue-600 hover:text-blue-800">
                    → Notifications
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
