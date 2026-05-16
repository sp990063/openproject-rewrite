/**
 * Webhook dispatcher - sends webhook payloads to registered endpoints.
 * Handles HMAC signing, retries with exponential backoff, and delivery tracking.
 */

import { prisma } from '../../lib/prisma'
import * as crypto from 'crypto'

// Retry delays in milliseconds: 1min, 5min, 30min, 2hr, 24hr
const RETRY_DELAYS = [
  60 * 1000,           // 1 minute
  5 * 60 * 1000,       // 5 minutes
  30 * 60 * 1000,      // 30 minutes
  2 * 60 * 60 * 1000,  // 2 hours
  24 * 60 * 60 * 1000, // 24 hours
]

const MAX_RETRIES = 5

interface Webhook {
  id: string
  url: string
  secret: string | null
  events: string[]
  projectId: string | null
  active: boolean
}

interface DispatchResult {
  success: boolean
  statusCode?: number
  responseBody?: string
  error?: string
}

/**
 * Generate HMAC-SHA256 signature for webhook payload.
 */
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

/**
 * Send HTTP POST request to webhook URL with JSON payload.
 */
async function sendWebhookRequest(
  url: string,
  payload: string,
  secret: string | null
): Promise<{ statusCode: number; body: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'OpenProject-Webhook/1.0',
    'X-OpenProject-Event': 'webhook',
  }

  // Add HMAC signature if secret is configured
  if (secret) {
    const signature = generateSignature(payload, secret)
    headers['X-OpenProject-Signature'] = `sha256=${signature}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: payload,
    signal: AbortSignal.timeout(30000), // 30 second timeout
  })

  const body = await response.text()

  return {
    statusCode: response.status,
    body: body.slice(0, 10000), // Limit stored response body
  }
}

/**
 * Calculate next retry time based on attempt count.
 */
function getNextRetryTime(attempts: number): Date | null {
  if (attempts >= MAX_RETRIES) return null
  const delay = RETRY_DELAYS[attempts] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1]
  return new Date(Date.now() + delay)
}

/**
 * Create a delivery record for tracking webhook deliveries.
 */
async function createDeliveryRecord(
  webhookId: string,
  event: string,
  payload: object
): Promise<string> {
  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId,
      event,
      payload: JSON.stringify(payload),
      status: 'pending',
      attempts: 0,
    },
  })
  return delivery.id
}

/**
 * Update delivery record after attempt.
 */
async function updateDeliveryRecord(
  deliveryId: string,
  result: DispatchResult
): Promise<void> {
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: result.success ? 'success' : 'failed',
      responseCode: result.statusCode,
      responseBody: result.responseBody,
      attempts: { increment: 1 },
      nextRetry: result.success ? null : undefined,
    },
  })
}

/**
 * Schedule a retry for failed deliveries.
 */
async function scheduleRetry(
  deliveryId: string,
  attempts: number
): Promise<void> {
  const nextRetry = getNextRetryTime(attempts)
  if (nextRetry) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { nextRetry },
    })
    // In production, this would be handled by a job queue (e.g., Bull, RQ)
    // For now, we'll implement a basic polling mechanism
  }
}

/**
 * Dispatch a webhook event to a single webhook endpoint.
 */
export async function dispatchWebhook(
  webhook: Webhook,
  event: string,
  payload: object
): Promise<void> {
  // Check if webhook is active
  if (!webhook.active) return

  // Check if webhook is subscribed to this event
  if (!webhook.events.includes(event)) return

  const payloadString = JSON.stringify(payload)

  // Create delivery record
  const deliveryId = await createDeliveryRecord(webhook.id, event, payload)

  try {
    // Send the webhook request
    const result = await sendWebhookRequest(webhook.url, payloadString, webhook.secret)

    const success = result.statusCode >= 200 && result.statusCode < 300

    await updateDeliveryRecord(deliveryId, {
      success,
      statusCode: result.statusCode,
      responseBody: result.body,
    })

    if (!success) {
      // Schedule retry for non-success status codes
      await scheduleRetry(deliveryId, 1)
    }
  } catch (error) {
    // Network error or timeout
    await updateDeliveryRecord(deliveryId, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    await scheduleRetry(deliveryId, 1)
  }
}

/**
 * Find all webhooks that should receive a specific event and dispatch to them.
 */
export async function dispatchToWebhooks(
  event: string,
  payload: object,
  projectId?: string
): Promise<void> {
  // Find all active webhooks subscribed to this event
  // Include both project-specific and system-wide (projectId = null) webhooks
  const webhooks = await prisma.webhook.findMany({
    where: {
      active: true,
      events: { has: event },
      OR: [
        { projectId: null }, // System-wide webhooks
        { projectId: projectId ?? undefined }, // Project-specific webhooks
      ],
    },
  })

  // Dispatch to all matching webhooks in parallel
  await Promise.all(
    webhooks.map(webhook =>
      dispatchWebhook(
        {
          id: webhook.id,
          url: webhook.url,
          secret: webhook.secret,
          events: webhook.events,
          projectId: webhook.projectId,
          active: webhook.active,
        },
        event,
        payload
      ).catch(err => {
        console.error(`Failed to dispatch webhook ${webhook.id}:`, err)
      })
    )
  )
}
