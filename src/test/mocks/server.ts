import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Set up the MSW server for Node.js testing (API route tests)
export const server = setupServer(...handlers)
