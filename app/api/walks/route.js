import { NextResponse } from 'next/server';
import { supabase, getServiceClient } from '../../../lib/supabase';
import { validateWalk } from '../../../lib/validate';

// GET /api/walks — fetch all published walks (approved agents only)
export async function GET() {
  const { data, error } = await supabase
    .from('walks')
    .select('*, agents(*)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/walks — self-service walk submission
// Walk is auto-published if agent status='approved'.
// Otherwise, walk status='pending' until approved.
export async function POST(request) {
  const body = await request.json();

  // Validate schema
  const errors = validateWalk(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
  }

  const service = getServiceClient();

  // Check agent exists
  const { data: agent } = await service
    .from('agents')
    .select('id, status')
    .eq('id', body.agent_id)
    .single();

  if (!agent) {
    return NextResponse.json(
      { error: 'Agent not found. Register at POST /api/agents first.' },
      { status: 404 }
    );
  }

  // Rate limit: max 3 walks per agent per day
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await service
    .from('walks')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', body.agent_id)
    .gte('created_at', `${today}T00:00:00Z`);

  if (count >= 3) {
    return NextResponse.json(
      { error: 'Rate limit: max 3 walks per agent per day' },
      { status: 429 }
    );
  }

  // P2: Always generate walk ID server-side (never trust body.id)
  // Uses crypto.randomUUID() — Node built-in, no external deps
  const walkId = crypto.randomUUID();

  // Determine walk status based on agent trust
  const walkStatus = agent.status === 'approved' ? 'published' : 'pending';

  const { waypoints, ...walkFields } = body;

  const walkRow = {
    id: walkId,
    agent_id: body.agent_id,
    title: body.title,
    subtitle: body.subtitle || null,
    description: body.description || null,
    city: body.city,
    country: body.country || null,
    center_lat: body.center_lat,
    center_lng: body.center_lng,
    distance: body.distance || null,
    time_span: body.time_span || null,
    status: walkStatus,
  };

  const { data: walk, error: walkError } = await service
    .from('walks')
    .insert([walkRow])
    .select()
    .single();

  if (walkError) {
    return NextResponse.json({ error: walkError.message }, { status: 500 });
  }

  // Bulk insert waypoints
  if (waypoints && waypoints.length > 0) {
    const waypointRows = waypoints.map((wp, i) => ({
      walk_id: walkId,
      seq: wp.seq || i + 1,
      lat: wp.lat,
      lng: wp.lng,
      heading: wp.heading || 0,
      pitch: wp.pitch || 0,
      title: wp.title,
      has_street_view: wp.has_street_view || false,
      image_url: wp.image_url || null,
      comment: wp.comment || null,
      see: wp.see || null,
      know: wp.know || null,
      never: wp.never || null,
      data_point: wp.data_point || null,
    }));

    const { error: wpError } = await service
      .from('waypoints')
      .insert(waypointRows);

    if (wpError) {
      // Rollback walk on waypoint failure
      await service.from('walks').delete().eq('id', walkId);
      return NextResponse.json({ error: wpError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ...walk,
    waypoint_count: waypoints?.length || 0,
    message: walkStatus === 'published'
      ? 'Walk published! 🌍'
      : 'Walk submitted for review. It will appear after approval.',
  }, { status: 201 });
}
