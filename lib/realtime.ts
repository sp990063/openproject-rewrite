// lib/realtime.ts
// Phase 6: Real-time SSE broadcast infrastructure
// Uses Redis pub/sub for serverless-compatible multi-instance broadcasts

export interface SSEEvent {
  type: 'work_package.updated' | 'work_package.created' | 'notification.new' | 'member.added' | 'connected';
  payload: unknown;
  timestamp: number;
  projectId?: string;
}

// Redis publisher singleton (shared across all API calls in same instance)
// For production with multiple serverless instances, use UPSTASH_REDIS_URL + UPSTASH_REDIS_TOKEN
let redisPublisher: any = null;

function getRedisUrl(): string | null {
  return process.env.UPSTASH_REDIS_REST_URL ?? process.env.REDIS_URL ?? null;
}

function getRedisToken(): string | null {
  return process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.REDIS_TOKEN ?? null;
}

function createRedisClient() {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return null;
  
  // Use ioredis if available, otherwise return null (SSE will be no-op)
  try {
    const Redis = require('ioredis');
    return new Redis(url, { token, maxRetriesPerRequest: 1 });
  } catch {
    return null;
  }
}

function getPublisher() {
  if (!redisPublisher) {
    redisPublisher = createRedisClient();
  }
  return redisPublisher;
}

export async function broadcastToUser(userId: string, event: SSEEvent) {
  const redis = getPublisher();
  if (!redis) {
    console.warn('[SSE] Redis not configured, skipping broadcast to user:', userId);
    return;
  }
  try {
    await redis.publish(`sse:${userId}`, JSON.stringify(event));
  } catch (e) {
    console.error('[SSE] Failed to broadcast to user:', userId, e);
  }
}

export async function broadcastToProject(
  projectId: string,
  event: SSEEvent,
  projectMemberUserIds: string[]
) {
  const redis = getPublisher();
  const message = JSON.stringify(event);
  
  if (!redis) {
    console.warn('[SSE] Redis not configured, skipping project broadcast:', projectId);
    return;
  }
  
  try {
    await Promise.all(
      projectMemberUserIds.map(userId =>
        redis.publish(`sse:${userId}`, message)
      )
    );
  } catch (e) {
    console.error('[SSE] Failed to broadcast to project:', projectId, e);
  }
}

export async function broadcastWorkPackageUpdate(
  workPackageId: string,
  data: Record<string, unknown>,
  prismaInstance: any
) {
  try {
    const workPackage = await prismaInstance.workPackage.findUnique({
      where: { id: workPackageId },
      select: { projectId: true },
    });
    if (!workPackage) return;

    const event: SSEEvent = {
      type: 'work_package.updated',
      payload: { id: workPackageId, ...data },
      timestamp: Date.now(),
      projectId: workPackage.projectId,
    };

    const members = await prismaInstance.member.findMany({
      where: { projectId: workPackage.projectId },
      select: { userId: true },
    });

    await broadcastToProject(
      workPackage.projectId,
      event,
      members.map((m: { userId: string }) => m.userId)
    );
  } catch (e) {
    console.error('[SSE] broadcastWorkPackageUpdate failed:', e);
  }
}
