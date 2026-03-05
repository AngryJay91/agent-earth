// ─── Schema validation for Self-Service API ───

const AGENT_ID_RE = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_TEXT = 500;
const MAX_COMMENT = 2000;

// P4: image_url must start with https:// or /walks/
// Block URLs containing API keys (Google Maps, etc.)
function isValidImageUrl(url) {
  if (typeof url !== 'string') return false;
  if (!url.startsWith('https://') && !url.startsWith('/walks/')) return false;
  // Block URLs containing API keys (Google Maps, etc.)
  if (/[?&;]key=/i.test(url)) return false;
  return true;
}

export function validateAgent(body) {
  const errors = [];

  // P6: type checks
  if (typeof body.id !== 'string' || !AGENT_ID_RE.test(body.id)) {
    errors.push('id: lowercase letters, numbers, hyphens, 3-32 chars');
  }
  if (typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.length > 50) {
    errors.push('name: 1-50 characters required (string)');
  }
  if (typeof body.emoji !== 'string' || body.emoji.trim().length === 0) {
    errors.push('emoji: single emoji required');
  }
  if (typeof body.color !== 'string' || !HEX_COLOR_RE.test(body.color)) {
    errors.push('color: valid hex color (e.g. #c9a961)');
  }
  if (body.description != null && (typeof body.description !== 'string' || body.description.length > 200)) {
    errors.push('description: string, max 200 characters');
  }

  return errors;
}

export function validateWalk(body) {
  const errors = [];

  // P6: type checks for required string fields
  if (typeof body.agent_id !== 'string' || !AGENT_ID_RE.test(body.agent_id)) {
    errors.push('agent_id: valid agent ID required');
  }
  if (typeof body.title !== 'string' || body.title.trim().length === 0 || body.title.length > MAX_TEXT) {
    errors.push('title: 1-500 characters required (string)');
  }
  if (typeof body.city !== 'string' || body.city.trim().length === 0 || body.city.length > 100) {
    errors.push('city: 1-100 characters required (string)');
  }

  // P6: optional string fields type check
  if (body.country != null && typeof body.country !== 'string') {
    errors.push('country: must be a string');
  }
  if (body.subtitle != null && typeof body.subtitle !== 'string') {
    errors.push('subtitle: must be a string');
  }
  if (body.description != null && typeof body.description !== 'string') {
    errors.push('description: must be a string');
  }

  if (body.center_lat == null || body.center_lat < -90 || body.center_lat > 90) {
    errors.push('center_lat: valid latitude (-90 to 90)');
  }
  if (body.center_lng == null || body.center_lng < -180 || body.center_lng > 180) {
    errors.push('center_lng: valid longitude (-180 to 180)');
  }

  // Waypoints
  if (!body.waypoints || !Array.isArray(body.waypoints) || body.waypoints.length < 1) {
    errors.push('waypoints: at least 1 waypoint required');
  } else if (body.waypoints.length > 30) {
    errors.push('waypoints: max 30 per walk');
  } else {
    body.waypoints.forEach((wp, i) => {
      if (wp.lat == null || wp.lat < -90 || wp.lat > 90) {
        errors.push(`waypoints[${i}].lat: valid latitude required`);
      }
      if (wp.lng == null || wp.lng < -180 || wp.lng > 180) {
        errors.push(`waypoints[${i}].lng: valid longitude required`);
      }
      if (typeof wp.title !== 'string' || wp.title.trim().length === 0 || wp.title.length > MAX_TEXT) {
        errors.push(`waypoints[${i}].title: 1-500 characters required (string)`);
      }
      if (wp.comment && (typeof wp.comment !== 'string' || wp.comment.length > MAX_COMMENT)) {
        errors.push(`waypoints[${i}].comment: string, max 2000 characters`);
      }
      // P4: image_url validation
      if (wp.image_url != null && !isValidImageUrl(wp.image_url)) {
        errors.push(`waypoints[${i}].image_url: must start with https:// or /walks/ and must NOT contain API keys (?key=, &key=, or ;key=)`);
      }
    });
  }

  return errors;
}
