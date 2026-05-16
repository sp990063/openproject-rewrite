import * as path from 'path'
import * as fs from 'fs'
import { execSync, exec } from 'child_process'

export interface GitCommit {
  sha: string
  message: string
  authorName: string
  authorEmail: string
  committedAt: Date
}

export interface GitTreeEntry {
  name: string
  type: 'blob' | 'tree'
  path: string
  sha: string
}

export interface GitDiff {
  sha1: string
  sha2: string
  files: Array<{
    path: string
    status: 'added' | 'deleted' | 'modified' | 'renamed'
    additions: number
    deletions: number
    patch?: string
  }>
}

/**
 * List all git repositories in a given directory
 */
export function listRepos(basePath: string): Array<{ name: string; path: string }> {
  try {
    const entries = fs.readdirSync(basePath, { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory())
      .filter(entry => {
        const gitPath = path.join(basePath, entry.name, '.git')
        return fs.existsSync(gitPath)
      })
      .map(entry => ({
        name: entry.name,
        path: path.join(basePath, entry.name),
      }))
  } catch {
    return []
  }
}

/**
 * Get commits from a git repository
 */
export function getCommits(repoPath: string, limit = 50): GitCommit[] {
  try {
    const output = execSync(
      `git -C "${repoPath}" log --format="%H|%s|%an|%ae|%ci" -n ${limit}`,
      { encoding: 'utf-8' }
    )

    return output.trim().split('\n').filter(Boolean).map(line => {
      const [sha, message, authorName, authorEmail, committedAt] = line.split('|')
      return {
        sha,
        message,
        authorName,
        authorEmail,
        committedAt: new Date(committedAt),
      }
    })
  } catch {
    return []
  }
}

/**
 * Get a single commit by SHA
 */
export function getCommit(repoPath: string, sha: string): GitCommit | null {
  try {
    const output = execSync(
      `git -C "${repoPath}" show --format="%H|%s|%an|%ae|%ci" -s ${sha}`,
      { encoding: 'utf-8' }
    )

    const [commitSha, message, authorName, authorEmail, committedAt] = output.trim().split('|')
    return {
      sha: commitSha,
      message,
      authorName,
      authorEmail,
      committedAt: new Date(committedAt),
    }
  } catch {
    return null
  }
}

/**
 * Get the tree structure of a commit (list of files)
 */
export function getTree(repoPath: string, sha: string): GitTreeEntry[] {
  try {
    const output = execSync(
      `git -C "${repoPath}" ls-tree -r --format="%(objectname)|%(objecttype)|%(path)" ${sha}`,
      { encoding: 'utf-8' }
    )

    return output.trim().split('\n').filter(Boolean).map(line => {
      const [sha, type, filePath] = line.split('\t')
      const name = filePath.split('/').pop() || filePath
      return {
        sha,
        type: type as 'blob' | 'tree',
        path: filePath,
        name,
      }
    })
  } catch {
    return []
  }
}

/**
 * Get diff between two commits
 */
export function getDiff(repoPath: string, sha1: string, sha2: string): GitDiff {
  try {
    const output = execSync(
      `git -C "${repoPath}" diff --stat ${sha1} ${sha2}`,
      { encoding: 'utf-8' }
    )

    // Parse stat output: " file1.txt | 5 ++--\n file2.txt | 10 ++++++"
    const files: GitDiff['files'] = []
    const statLines = output.trim().split('\n')

    for (const line of statLines) {
      const match = line.match(/^\s*(.+?)\s*\|\s*(\d+)\s*([+\-]+)$/)
      if (match) {
        const [, filePath, changesStr, changeType] = match
        const changes = parseInt(changesStr, 10)
        const additions = (changeType.match(/\+/g) || []).length
        const deletions = (changeType.match(/-/g) || []).length

        files.push({
          path: filePath.trim(),
          status: changes > additions + deletions ? 'modified' :
                  additions > 0 && deletions === 0 ? 'added' :
                  deletions > 0 && additions === 0 ? 'deleted' : 'modified',
          additions,
          deletions: changes - additions,
        })
      }
    }

    return { sha1, sha2, files }
  } catch {
    return { sha1, sha2, files: [] }
  }
}

/**
 * Get file content at a specific commit (async for large files)
 */
export async function getFileContent(repoPath: string, sha: string, filePath: string): Promise<string | null> {
  return new Promise(resolve => {
    exec(`git -C "${repoPath}" show ${sha}:${filePath}`, (err, stdout) => {
      if (err) resolve(null)
      else resolve(stdout)
    })
  })
}