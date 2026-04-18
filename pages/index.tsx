import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
            <span className="text-blue-600">OpenProject</span> Rewrite
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            A modern, fast, and intuitive project management solution built with Next.js, Prisma, and Tailwind.
          </p>
          <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
            <div className="space-x-4">
              <Link href="/login">
                <Button variant="primary" size="lg">
                  Get Started
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="secondary" size="lg">
                  View Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {[
            {
              title: 'Fast & Responsive',
              description: 'Built with Next.js 15 for optimal performance and seamless user experience.',
            },
            {
              title: 'Type-Safe',
              description: 'Full TypeScript support with Prisma ORM for type-safe database operations.',
            },
            {
              title: 'Modern Stack',
              description: 'Uses Zustand, TanStack Query, and Tailwind for state management and styling.',
            },
          ].map((feature, index) => (
            <div key={index} className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
