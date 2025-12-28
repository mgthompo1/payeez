// ============================================
// Rate Limiting Middleware
// Token bucket algorithm with sliding window
// ============================================

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyPrefix?: string // Redis key prefix
}

interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: number // Unix timestamp when window resets
  retryAfter?: number // Seconds until retry allowed
}

// In-memory store for development (use Redis in production)
const memoryStore = new Map<string, { count: number; resetAt: number }>()

export class RateLimiter {
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  /**
   * Check if request is allowed
   */
  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now()
    const fullKey = `${this.config.keyPrefix || 'rl'}:${key}`

    let entry = memoryStore.get(fullKey)

    // Create new window if doesn't exist or expired
    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 0,
        resetAt: now + this.config.windowMs,
      }
      memoryStore.set(fullKey, entry)
    }

    const remaining = Math.max(0, this.config.maxRequests - entry.count - 1)
    const reset = Math.ceil(entry.resetAt / 1000)

    // Check if over limit
    if (entry.count >= this.config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      return {
        allowed: false,
        limit: this.config.maxRequests,
        remaining: 0,
        reset,
        retryAfter,
      }
    }

    // Increment counter
    entry.count++

    return {
      allowed: true,
      limit: this.config.maxRequests,
      remaining,
      reset,
    }
  }

  /**
   * Get headers for rate limit response
   */
  getHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.reset),
    }

    if (result.retryAfter) {
      headers['Retry-After'] = String(result.retryAfter)
    }

    return headers
  }
}

// Pre-configured rate limiters for different endpoints
export const rateLimiters = {
  // Standard API rate limit: 100 requests per minute
  api: new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: 'api',
  }),

  // Payment creation: 20 per minute (stricter)
  payments: new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'pay',
  }),

  // Tokenization: 50 per minute
  tokens: new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 50,
    keyPrefix: 'tok',
  }),

  // Auth attempts: 5 per minute
  auth: new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'auth',
  }),

  // Webhook delivery: 1000 per minute
  webhooks: new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 1000,
    keyPrefix: 'wh',
  }),
}

/**
 * Clean up expired entries periodically
 */
export function startCleanupInterval(intervalMs = 60000): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetAt <= now) {
        memoryStore.delete(key)
      }
    }
  }, intervalMs)
}
