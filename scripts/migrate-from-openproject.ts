#!/usr/bin/env npx ts-node
/**
 * migrate-from-openproject.ts
 * Phase 6: Batch migration script from existing OpenProject Rails database
 * 
 * Usage:
 *   npx ts-node scripts/migrate-from-openproject.ts
 * 
 * Prerequisites:
 *   - OLD_OPENPROJECT_DATABASE_URL env var pointing to the old Rails DB
 *   - DATABASE_URL env var pointing to the new Next.js DB
 */

import { PrismaClient as NewPrisma } from '../lib/prisma'

// Type for old DB connection (read-only, inferred at runtime)
type OldPrisma = any

const newDb = new NewPrisma()

interface MigrationResult {
  total: number
  succeeded: number
  failed: number
  errors: { id: string; error: string }[]
  retries: number
}

async function migrateWithBatch<T extends { id: { toString: () => string } }>({
  tableName,
  rows,
  batchSize = 500,
  transform,
}: {
  tableName: string
  rows: T[]
  batchSize?: number
  transform: (row: T) => Promise<unknown>
}): Promise<MigrationResult> {
  const MAX_RETRIES = 2
  const result: MigrationResult = { total: rows.length, succeeded: 0, failed: 0, errors: [], retries: 0 }

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1

    console.log(`[${tableName}] Batch ${batchNum}/${Math.ceil(rows.length / batchSize)} — rows ${i + 1}–${i + batch.length}/${rows.length}`)

    async function attemptBatch(batchRows: T[], attempt: number): Promise<void> {
      try {
        await newDb.$transaction(
          batchRows.map(row => transform(row)),
          { timeout: 30_000 }
        )
        result.succeeded += batchRows.length
        console.log(`[${tableName}] Batch ${batchNum} committed (${batchRows.length} rows)`)
      } catch (batchError) {
        if (attempt < MAX_RETRIES) {
          result.retries++
          const delay = Math.pow(2, attempt) * 500
          console.warn(`[${tableName}] Batch ${batchNum} attempt ${attempt} failed, retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return attemptBatch(batchRows, attempt + 1)
        }

        console.error(`[${tableName}] Batch ${batchNum} failed after ${MAX_RETRIES} retries, falling back to individual inserts`)
        for (const row of batchRows) {
          try {
            await newDb.$transaction([transform(row)], { timeout: 10_000 })
            result.succeeded++
          } catch (rowError) {
            result.failed++
            result.errors.push({ id: row.id.toString(), error: String(rowError) })
          }
        }
      }
    }

    await attemptBatch(batch, 0)
  }

  if (result.failed > 0) {
    console.warn(`[${tableName}] Migration completed with ${result.failed} failures`)
    console.warn(`[${tableName}] Failed IDs:`, result.errors.map(e => e.id).join(', '))
  } else {
    console.log(`[${tableName}] Migration complete: ${result.succeeded}/${result.total} rows`)
  }

  return result
}

async function migrateUsers(oldDb: OldPrisma): Promise<MigrationResult> {
  console.log('[Users] Reading from old database...')
  const oldUsers = await oldDb.$queryRaw<any[]>`
    SELECT id, mail, firstname, lastname, hashed_password, created_on
    FROM users
    WHERE type = 'User' AND status = 1
    ORDER BY id ASC
  `

  return migrateWithBatch({
    tableName: 'users',
    rows: oldUsers,
    batchSize: 500,
    transform: async (user: any) =>
      newDb.user.upsert({
        where: { id: user.id.toString() },
        create: {
          id: user.id.toString(),
          email: user.mail,
          name: `${user.firstname} ${user.lastname}`,
          passwordHash: user.hashed_password,
          passwordMigrationRequired: true,
          createdAt: user.created_on,
        },
        update: {
          email: user.mail,
          name: `${user.firstname} ${user.lastname}`,
        },
      }),
  })
}

async function migrateProjects(oldDb: OldPrisma): Promise<MigrationResult> {
  console.log('[Projects] Reading from old database...')
  const oldProjects = await oldDb.$queryRaw<any[]>`
    SELECT id, name, identifier, description, created_on AS createdAt, updated_on AS updatedAt
    FROM projects
    WHERE status = 1
    ORDER BY id ASC
  `

  return migrateWithBatch({
    tableName: 'projects',
    rows: oldProjects,
    batchSize: 500,
    transform: async (project: any) =>
      newDb.project.upsert({
        where: { id: project.id.toString() },
        create: {
          id: project.id.toString(),
          name: project.name,
          identifier: project.identifier,
          description: project.description ?? '',
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
        update: {
          name: project.name,
          description: project.description ?? '',
          updatedAt: project.updatedAt,
        },
      }),
  })
}

async function migrateWorkPackages(oldDb: OldPrisma): Promise<MigrationResult> {
  console.log('[WorkPackages] Reading from old database...')
  const oldWps = await oldDb.$queryRaw<any[]>`
    SELECT id, project_id AS projectId, subject, description,
           status_id AS statusId, type_id AS typeId,
           assigned_to_id AS assigneeId, author_id AS authorId,
           start_date AS startDate, due_date AS dueDate,
           estimated_hours AS estimatedHours,
           created_on AS createdAt, updated_on AS updatedAt
    FROM work_packages
    WHERE deleted_at IS NULL
    ORDER BY id ASC
  `

  return migrateWithBatch({
    tableName: 'work_packages',
    rows: oldWps,
    batchSize: 200,
    transform: async (wp: any) =>
      newDb.workPackage.upsert({
        where: { id: wp.id.toString() },
        create: {
          id: wp.id.toString(),
          projectId: wp.projectId.toString(),
          subject: wp.subject,
          description: wp.description ?? '',
          statusId: wp.statusId?.toString() ?? '',
          typeId: wp.typeId?.toString() ?? '',
          assigneeId: wp.assigneeId?.toString() ?? null,
          authorId: wp.authorId?.toString() ?? '',
          startDate: wp.startDate,
          dueDate: wp.dueDate,
          estimatedHours: wp.estimatedHours,
          createdAt: wp.createdAt,
          updatedAt: wp.updatedAt,
        },
        update: {
          subject: wp.subject,
          description: wp.description ?? '',
          updatedAt: wp.updatedAt,
        },
      }),
  })
}

async function main() {
  console.log('=== OpenProject Migration Script ===')
  console.log('This script migrates data from the old Rails OpenProject database to the new Next.js one.')
  console.log('')
  
  if (!process.env.OLD_OPENPROJECT_DATABASE_URL) {
    console.error('ERROR: OLD_OPENPROJECT_DATABASE_URL env var is required')
    process.exit(1)
  }

  // Dynamically create old DB client
  // In production, you would import the old schema's Prisma client
  console.log('[Setup] Connecting to old database...')
  console.log('[Setup] Note: Old OpenProject Prisma schema not included in this codebase.')
  console.log('[Setup] Please create a separate prisma client for the old database.')
  console.log('')
  
  // Placeholder — the old DB connection would be created here
  const oldDb: OldPrisma = null as any
  
  try {
    console.log('[Migration] Starting migration in dependency order...')
    console.log('')

    // Run migrations in order (parents first)
    await migrateUsers(oldDb)
    await migrateProjects(oldDb)
    await migrateWorkPackages(oldDb)

    console.log('')
    console.log('=== Migration Complete ===')
  } finally {
    await newDb.$disconnect()
  }
}

main().catch(console.error)
