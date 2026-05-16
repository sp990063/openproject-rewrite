/**
 * Parse commit messages for work package references like #123
 * and create links to work packages
 */

import { prisma } from '@/lib/prisma'

// Regex to match #123 style work package references
const WP_REF_REGEX = /#(\d+)/g

export interface ParsedCommitMessage {
  html: string
  workPackageIds: string[]
}

/**
 * Parse a commit message and return HTML with work package links
 */
export function parseCommitMessage(message: string): ParsedCommitMessage {
  const workPackageIds: string[] = []

  // Replace #123 with links
  const html = message.replace(WP_REF_REGEX, (match, wpId) => {
    workPackageIds.push(wpId)
    return `<a href="/work-packages/${wpId}" class="wp-link" data-wp-id="${wpId}">#${wpId}</a>`
  })

  return { html, workPackageIds }
}

/**
 * Link a commit SHA to a work package ID in the database
 */
export async function linkCommitToWP(
  repositoryId: string,
  sha: string,
  wpId: string
): Promise<void> {
  // First, ensure the commit exists
  const commit = await prisma.commit.findFirst({
    where: {
      sha,
      repositoryId,
    },
  })

  if (!commit) {
    throw new Error(`Commit ${sha} not found in repository ${repositoryId}`)
  }

  // Then create or find the work package
  const workPackage = await prisma.workPackage.findUnique({
    where: { id: wpId },
  })

  if (!workPackage) {
    throw new Error(`Work package ${wpId} not found`)
  }

  // Create the link
  await prisma.commitWorkPackage.upsert({
    where: {
      commitId_workPackageId: {
        commitId: commit.id,
        workPackageId: wpId,
      },
    },
    update: {},
    create: {
      commitId: commit.id,
      workPackageId: wpId,
    },
  })
}

/**
 * Get work packages linked to a commit
 */
export async function getLinkedWorkPackages(sha: string, repositoryId: string) {
  const commit = await prisma.commit.findFirst({
    where: { sha, repositoryId },
    include: {
      workPackages: {
        include: {
          workPackage: true,
        },
      },
    },
  })

  return commit?.workPackages.map(cwp => cwp.workPackage) ?? []
}

/**
 * Extract work package IDs from a commit message
 */
export function extractWorkPackageIds(message: string): string[] {
  const ids: string[] = []
  let match
  while ((match = WP_REF_REGEX.exec(message)) !== null) {
    ids.push(match[1])
  }
  // Reset regex state
  WP_REF_REGEX.lastIndex = 0
  return ids
}