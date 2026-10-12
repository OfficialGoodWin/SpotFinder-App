import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAddSpotDraft,
  hasMeaningfulAddSpotDraft,
  validateRequiredSpotFields,
  voiceErrorMessage,
  searchFailureMessage,
} from '../src/lib/contributionFlow.js';
import { shouldShowWelcome, visibleExploreSpots } from '../src/lib/discoveryExperience.js';
import { setSpotRelationState } from '../src/lib/spotSocialState.js';

test('sequences first-visit welcome after consent and respects dismissal', () => {
  assert.equal(shouldShowWelcome({ dismissed: false, consentDecided: false }), false);
  assert.equal(shouldShowWelcome({ dismissed: false, consentDecided: true }), true);
  assert.equal(shouldShowWelcome({ dismissed: true, consentDecided: true }), false);
});

test('explore strip only uses real map records with valid coordinates', () => {
  const spots = [
    { id: 'one', lat: 50, lng: 14 },
    { id: 'broken', lat: 'north', lng: 14 },
    { id: 'two', lat: 51, lon: 15 },
    { id: 'three', lat: 52, lng: 16 },
    { id: 'four', lat: 53, lng: 17 },
  ];
  assert.deepEqual(visibleExploreSpots(spots).map(spot => spot.id), ['one', 'two', 'three']);
});

test('validates required contribution fields with meaningful messages', () => {
  assert.deepEqual(Object.keys(validateRequiredSpotFields({ title: '', description: '', attested: false })), ['title', 'description', 'attested']);
  assert.ok(validateRequiredSpotFields({ title: 'spot', description: 'Useful', attested: true }).title);
  assert.deepEqual(validateRequiredSpotFields({ title: 'Old Quarry', description: 'A quiet viewpoint.', attested: true }), {});
});

test('normalizes and detects saved drafts including optional rating enrichment', () => {
  const empty = createAddSpotDraft();
  assert.equal(hasMeaningfulAddSpotDraft(empty), false);
  const draft = createAddSpotDraft({ title: ' Ridge ', tags: 'bad', bestTime: ['sunset'], crowdednessRating: '2' });
  assert.deepEqual(draft.tags, []);
  assert.equal(draft.crowdednessRating, 2);
  assert.equal(hasMeaningfulAddSpotDraft(draft), true);
});

test('maps microphone and recognition failures to distinct actionable messages', () => {
  const messages = [
    voiceErrorMessage('no-device'),
    voiceErrorMessage({ name: 'NotAllowedError' }),
    voiceErrorMessage('unsupported'),
    voiceErrorMessage({ error: 'network' }),
    voiceErrorMessage({ error: 'no-speech' }),
  ];
  assert.equal(new Set(messages).size, 5);
  assert.match(messages[0], /No microphone/);
  assert.match(messages[1], /denied/);
  assert.match(messages[2], /not supported/);
  assert.match(messages[3], /network/);
  assert.match(messages[4], /try again/);
});

test('distinguishes offline search failures from service failures', () => {
  assert.match(searchFailureMessage({ name: 'TypeError', message: 'Failed to fetch' }), /network/);
  assert.match(searchFailureMessage(new Error('provider refused')), /temporarily unavailable/);
  assert.equal(searchFailureMessage({ name: 'AbortError' }), '');
});

test('like and save transitions update counts once and roll back cleanly', () => {
  const initial = { liked: false, saved: false, likesCount: 0, savesCount: 2 };
  const liked = setSpotRelationState(initial, 'like', true);
  assert.deepEqual(liked, { liked: true, saved: false, likesCount: 1, savesCount: 2 });
  assert.deepEqual(setSpotRelationState(liked, 'like', true), liked);
  assert.deepEqual(setSpotRelationState(liked, 'like', false), initial);
  const saved = setSpotRelationState(initial, 'save', true);
  assert.equal(saved.savesCount, 3);
  const unsaved = setSpotRelationState(saved, 'save', false);
  assert.equal(unsaved.savesCount, 2);
  assert.equal(unsaved.saved, false);
});
