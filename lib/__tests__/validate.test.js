// Tests for lib/validate.js — isValidImageUrl (plan.md #1 test plan)
// Run: node --test lib/__tests__/validate.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWalk } from '../validate.js';

// Helper: build a minimal valid walk body with a single waypoint
function makeWalk(imageUrl) {
  const wp = {
    lat: 37.5665,
    lng: 126.9780,
    title: 'Test Waypoint',
  };
  if (imageUrl !== undefined) wp.image_url = imageUrl;
  return {
    agent_id: 'test-agent',
    title: 'Test Walk',
    city: 'Seoul',
    center_lat: 37.5665,
    center_lng: 126.9780,
    waypoints: [wp],
  };
}

function hasImageError(errors) {
  return errors.some(e => e.includes('image_url'));
}

// Case 1: Wikimedia HTTPS URL — should pass
test('case 1: Wikimedia https URL passes', () => {
  const errors = validateWalk(makeWalk('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/320px.jpg'));
  assert.equal(hasImageError(errors), false, `Unexpected image_url error: ${errors}`);
});

// Case 2: /walks/ relative path — should pass
test('case 2: /walks/ relative path passes', () => {
  const errors = validateWalk(makeWalk('/walks/img.jpg'));
  assert.equal(hasImageError(errors), false, `Unexpected image_url error: ${errors}`);
});

// Case 3: Google Street View URL with key= query param — should be rejected
test('case 3: Google Street View URL with ?key= is rejected', () => {
  const errors = validateWalk(makeWalk('https://maps.googleapis.com/maps/api/streetview?size=640x640&location=37.5,126.9&key=AIzaSyFakeKey'));
  assert.equal(hasImageError(errors), true, 'Expected image_url to be rejected due to ?key=');
});

// Case 4: URL with &key= in the middle — should be rejected
test('case 4: URL with &key= param is rejected', () => {
  const errors = validateWalk(makeWalk('https://example.com/img?foo=bar&key=SECRET'));
  assert.equal(hasImageError(errors), true, 'Expected image_url to be rejected due to &key=');
});

// Case 5: URL whose path contains "key" but no ?key= / &key= — should pass
test('case 5: URL path containing "key" without query param passes', () => {
  const errors = validateWalk(makeWalk('https://example.com/keyboard.jpg'));
  assert.equal(hasImageError(errors), false, `Unexpected image_url error: ${errors}`);
});

// Case 6: null image_url (optional field omitted) — should pass
test('case 6: null image_url (optional) passes', () => {
  const errors = validateWalk(makeWalk(null));
  assert.equal(hasImageError(errors), false, `Unexpected image_url error: ${errors}`);
});

// Case 7: http:// URL (not https) — should be rejected
test('case 7: http:// URL is rejected (must be https)', () => {
  const errors = validateWalk(makeWalk('http://example.com/img.jpg'));
  assert.equal(hasImageError(errors), true, 'Expected http:// URL to be rejected');
});
