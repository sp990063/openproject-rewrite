import '@testing-library/jest-dom'
import { afterEach, beforeAll, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './mocks/server'
import { resetMockDb } from './mocks/handlers'

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset handlers after each test (and reset mock DB for isolation)
afterEach(() => {
  server.resetHandlers()
  resetMockDb()
  cleanup()
})

// Close server after all tests
afterAll(() => server.close())
