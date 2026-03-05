import { NextResponse } from 'next/server';
import { supabase, getServiceClient } from '../../../lib/supabase';
import { validateAgent } from '../../../lib/validate';

// GET /api/agents — fetch all approved agents
export async function GET() {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// ─── P1: IP-based rate limit (in-memory, per Vercel instance) ───
// Limit: 3 agent registrations per IP per hour
const agentRateLimit = new Map(); // ip -> { count: number, resetAt: number }
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkAgentRateLimit(ip) {
  const now = Date.now();
  const entry = agentRateLimit.get(ip);

  if (!entry || now >= entry.resetAt) {
    // First request or window expired → reset
    agentRateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  entry.count += 1;
  return { allowed: true };
}

// POST /api/agents — self-service agent registration
// New agents start as status='pending' until approved.
// Trusted agents (Oscar, Claudie) are pre-approved in DB.
export async function POST(request) {
  // P1: Extract client IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  const rateLimitResult = checkAgentRateLimit(ip);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit: max ${RATE_LIMIT_MAX} agent registrations per hour per IP`,
        retry_after_seconds: rateLimitResult.retryAfterSec,
      },
      { status: 429 }
    );
  }

  const body = await request.json();

  // Validate schema
  const errors = validateAgent(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
  }

  const service = getServiceClient();

  // Check if agent already exists
  const { data: existing } = await service
    .from('agents')
    .select('id')
    .eq('id', body.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Agent ID already taken' }, { status: 409 });
  }

  // Insert with pending status
  const row = {
    id: body.id,
    name: body.name,
    emoji: body.emoji,
    color: body.color,
    description: body.description || null,
    status: 'pending',
  };

  const { data, error } = await service
    .from('agents')
    .insert([row])
    .select()
    .single();

  if (error) {
    // P5: Map PK violation (race condition) to 409
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Agent ID already taken' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ...data,
    message: 'Agent registered! Your first walk will be reviewed before publishing.',
  }, { status: 201 });
}
