/**
 * Tests for wedding/matchmaking event definitions.
 *
 * Covers:
 *   - WEDDING_EVENTS has exactly 3 entries
 *   - Expected event IDs are present
 *   - All wedding events have category 'domestic'
 *   - Each event has at least one choice
 *   - Each event has actorRequirements with ≥ 2 slots
 *   - All events are registered in ALL_EVENTS
 */

import { describe, it, expect } from 'vitest';
import { WEDDING_EVENTS } from '../../src/simulation/events/definitions/weddings';
import { ALL_EVENTS } from '../../src/simulation/events/event-filter';

const EXPECTED_IDS = [
  'dom_elder_arranges_match',
  'dom_father_arranges_sons_match',
  'dom_mother_arranges_daughters_match',
] as const;

describe('WEDDING_EVENTS — structure', () => {
  it('contains exactly 3 events', () => {
    expect(WEDDING_EVENTS).toHaveLength(3);
  });

  it('has the expected event IDs', () => {
    const ids = WEDDING_EVENTS.map(e => e.id);
    for (const expected of EXPECTED_IDS) {
      expect(ids).toContain(expected);
    }
  });

  it('all events have category domestic', () => {
    for (const event of WEDDING_EVENTS) {
      expect(event.category).toBe('domestic');
    }
  });

  it('each event has at least one choice', () => {
    for (const event of WEDDING_EVENTS) {
      expect(event.choices.length).toBeGreaterThan(0);
    }
  });

  it('each event has actorRequirements with ≥ 2 slots', () => {
    for (const event of WEDDING_EVENTS) {
      expect((event.actorRequirements ?? []).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('each event has a non-empty title and description', () => {
    for (const event of WEDDING_EVENTS) {
      expect(event.title.length).toBeGreaterThan(0);
      expect(event.description.length).toBeGreaterThan(0);
    }
  });
});

describe('WEDDING_EVENTS — registration', () => {
  const allIds = new Set(ALL_EVENTS.map(e => e.id));

  it('all wedding events are registered in ALL_EVENTS', () => {
    for (const event of WEDDING_EVENTS) {
      expect(allIds.has(event.id)).toBe(true);
    }
  });
});

describe('WEDDING_EVENTS — individual event shapes', () => {
  it('dom_elder_arranges_match has 3 choices', () => {
    const e = WEDDING_EVENTS.find(ev => ev.id === 'dom_elder_arranges_match');
    expect(e).toBeDefined();
    expect(e!.choices).toHaveLength(3);
  });

  it('dom_father_arranges_sons_match has a childOfSlot criterion on the son slot', () => {
    const e = WEDDING_EVENTS.find(ev => ev.id === 'dom_father_arranges_sons_match');
    expect(e).toBeDefined();
    const sonReq = e!.actorRequirements!.find(r => r.slot === 'son');
    expect(sonReq?.criteria.childOfSlot).toBe('father');
  });

  it('dom_mother_arranges_daughters_match has a childOfSlot criterion on the daughter slot', () => {
    const e = WEDDING_EVENTS.find(ev => ev.id === 'dom_mother_arranges_daughters_match');
    expect(e).toBeDefined();
    const daughterReq = e!.actorRequirements!.find(r => r.slot === 'daughter');
    expect(daughterReq?.criteria.childOfSlot).toBe('mother');
  });
});
