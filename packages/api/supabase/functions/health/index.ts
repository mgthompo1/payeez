/**
 * Health Check Endpoint
 *
 * This endpoint provides health status for the Payeez platform.
 * It's used by:
 * - Load balancers for routing decisions
 * - SDK circuit breakers for failover logic
 * - Monitoring systems for alerting
 *
 * Returns:
 * - 200: Service is healthy
 * - 503: Service is degraded or down
 *
 * Response includes:
 * - status: 'healthy' | 'degraded' | 'down'
 * - timestamp: ISO timestamp
 * - region: The region this instance is running in
 * - dependencies: Health status of downstream services
 * - latency: Response time in ms
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  region: string;
  version: string;
  uptime: number;
  latency: {
    database: number | null;
    basisTheory: number | null;
  };
  dependencies: {
    database: 'healthy' | 'degraded' | 'down';
    basisTheory: 'healthy' | 'degraded' | 'down';
  };
}

// Track service start time for uptime calculation
const startTime = Date.now();

// Check database health
async function checkDatabaseHealth(): Promise<{ status: 'healthy' | 'degraded' | 'down'; latencyMs: number }> {
  const start = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Simple query to check DB connectivity
    const { error } = await supabase.from('tenants').select('id').limit(1);

    const latencyMs = Date.now() - start;

    if (error) {
      return { status: 'down', latencyMs };
    }

    // Consider degraded if latency > 500ms
    if (latencyMs > 500) {
      return { status: 'degraded', latencyMs };
    }

    return { status: 'healthy', latencyMs };
  } catch {
    return { status: 'down', latencyMs: Date.now() - start };
  }
}

// Check Basis Theory health
async function checkBasisTheoryHealth(): Promise<{ status: 'healthy' | 'degraded' | 'down'; latencyMs: number }> {
  const start = Date.now();

  try {
    const btApiKey = Deno.env.get('BASIS_THEORY_API_KEY');

    if (!btApiKey) {
      return { status: 'down', latencyMs: 0 };
    }

    // Call BT's health endpoint or a simple API call
    const response = await fetch('https://api.basistheory.com/applications/self', {
      headers: {
        'BT-API-KEY': btApiKey,
      },
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      return { status: 'down', latencyMs };
    }

    if (latencyMs > 1000) {
      return { status: 'degraded', latencyMs };
    }

    return { status: 'healthy', latencyMs };
  } catch {
    return { status: 'down', latencyMs: Date.now() - start };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStart = Date.now();

  try {
    // Run health checks in parallel
    const [dbHealth, btHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkBasisTheoryHealth(),
    ]);

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'down' = 'healthy';

    if (dbHealth.status === 'down') {
      overallStatus = 'down'; // Database is critical
    } else if (dbHealth.status === 'degraded' || btHealth.status === 'degraded') {
      overallStatus = 'degraded';
    } else if (btHealth.status === 'down') {
      overallStatus = 'degraded'; // BT down = degraded (can use VGS fallback)
    }

    const response: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      region: Deno.env.get('REGION') || 'us-east-1',
      version: '1.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      latency: {
        database: dbHealth.latencyMs,
        basisTheory: btHealth.latencyMs,
      },
      dependencies: {
        database: dbHealth.status,
        basisTheory: btHealth.status,
      },
    };

    // Record health check in database (fire and forget)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.rpc('record_health_check', {
        p_service_name: 'payeez_api',
        p_region: response.region,
        p_status: response.status,
        p_latency_ms: Date.now() - requestStart,
      });
    } catch {
      // Ignore errors in recording
    }

    return new Response(JSON.stringify(response), {
      status: overallStatus === 'down' ? 503 : 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    const errorResponse: HealthResponse = {
      status: 'down',
      timestamp: new Date().toISOString(),
      region: Deno.env.get('REGION') || 'unknown',
      version: '1.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      latency: {
        database: null,
        basisTheory: null,
      },
      dependencies: {
        database: 'down',
        basisTheory: 'down',
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 503,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});
