/**
 * Tests for construction logic.
 *
 * Covers canBuild validation, startConstruction, assignBuilder / removeBuilder,
 * processConstruction progress + completion, and cancelConstruction refund.
 */

import { describe, it, expect } from 'vitest';
import { createRNG } from '../../src/utils/rng';
import {
  canBuild,
  startConstruction,
  assignBuilder,
  removeBuilder,
  processConstruction,
  cancelConstruction,
} from '../../src/simulation/buildings/construction';
import type { Settlement } from '../../src/simulation/turn/game-state';
import type { Person } from '../../src/simulation/population/person';
import { createPerson } from '../../src/simulation/population/person';
import { emptyResourceStock } from '../../src/simulation/economy/resources';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSettlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    name: 'Test',
    location: 'test',
    buildings: [{ defId: 'camp', instanceId: 'camp_0', builtTurn: 0, style: null }],
    constructionQueue: [],
    resources: {
      ...emptyResourceStock(),
      food: 50,
      lumber: 30,
      stone: 20,
      gold: 50,
      goods: 10,
      medicine: 10,
      cattle: 5,
      steel: 5,
      horses: 2,
    },
    populationCount: 5,
    ...overrides,
  };
}

function makePeople(n: number): Map<string, Person> {
  const rng = createRNG(999);
  const map = new Map<string, Person>();
  for (let i = 0; i < n; i++) {
    const p = createPerson({
      sex: 'male',
      age: 25,
    }, rng);
    map.set(p.id, p);
  }
  return map;
}

// ─── canBuild ─────────────────────────────────────────────────────────────────

describe('canBuild', () => {
  it('allows building longhouse when camp exists and resources are sufficient', () => {
    const settlement = makeSettlement();
    const result = canBuild(settlement, 'longhouse', null);
    expect(result.ok).toBe(true);
  });

  it('rejects longhouse when camp is missing', () => {
    const settlement = makeSettlement({ buildings: [] });
    const result = canBuild(settlement, 'longhouse', null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Requires');
  });

  it('rejects when resources are insufficient', () => {
    const settlement = makeSettlement({
      resources: { ...emptyResourceStock(), lumber: 2 }, // need 15
    });
    const result = canBuild(settlement, 'longhouse', null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/lumber|insufficient/i);
  });

  it('rejects great_hall when only camp exists (longhouse required)', () => {
    const settlement = makeSettlement();
    const result = canBuild(settlement, 'great_hall', null);
    expect(result.ok).toBe(false);
  });

  it('allows great_hall when longhouse is present', () => {
    const settlement = makeSettlement({
      buildings: [
        { defId: 'camp',      instanceId: 'camp_0',      builtTurn: 0, style: null },
        { defId: 'longhouse', instanceId: 'longhouse_0', builtTurn: 1, style: null },
      ],
      resources: {
        ...emptyResourceStock(),
        lumber: 50, stone: 50, gold: 50, goods: 50,
        food: 50, medicine: 10, cattle: 5, steel: 5, horses: 2,
      },
    });
    const result = canBuild(settlement, 'great_hall', null);
    expect(result.ok).toBe(true);
  });

  it('rejects building already in queue', () => {
    const settlement = makeSettlement();
    const { project } = startConstruction(settlement, 'granary', null, 1);
    const settled2 = { ...settlement, constructionQueue: [project] };
    // Starting the same building again should fail (already in queue or built)
    const result = canBuild(settled2, 'granary', null);
    expect(result.ok).toBe(false);
  });
});

// ─── startConstruction ────────────────────────────────────────────────────────

describe('startConstruction', () => {
  it('creates a new project with correct totalPoints', () => {
    const settlement = makeSettlement();
    const { project } = startConstruction(settlement, 'longhouse', null, 1);
    // Longhouse is 2 seasons = 200 points
    expect(project.totalPoints).toBe(200);
    expect(project.progressPoints).toBe(0);
    expect(project.defId).toBe('longhouse');
    expect(project.style).toBe(null);
    expect(project.assignedWorkerIds).toHaveLength(0);
    expect(project.startedTurn).toBe(1);
  });

  it('deducts resources immediately', () => {
    const settlement = makeSettlement();
    const before = settlement.resources.lumber;
    const { updatedResources } = startConstruction(settlement, 'longhouse', null, 1);
    // Longhouse costs 15 lumber + 5 stone
    expect(updatedResources.lumber).toBe(before - 15);
    expect(updatedResources.stone).toBe(settlement.resources.stone - 5);
  });

  it('records resourcesSpent for cancel refund', () => {
    const settlement = makeSettlement();
    const { project } = startConstruction(settlement, 'longhouse', null, 1);
    expect(project.resourcesSpent['lumber']).toBe(15);
    expect(project.resourcesSpent['stone']).toBe(5);
  });
});

// ─── assignBuilder / removeBuilder ───────────────────────────────────────────

describe('assignBuilder / removeBuilder', () => {
  it('adds person to project worker list', () => {
    const settlement = makeSettlement();
    const { project } = startConstruction(settlement, 'longhouse', null, 1);
    const updated = assignBuilder(project, 'person_1');
    expect(updated.assignedWorkerIds).toContain('person_1');
  });

  it('does not duplicate if assigned twice', () => {
    const settlement = makeSettlement();
    const { project } = startConstruction(settlement, 'longhouse', null, 1);
    const p1 = assignBuilder(project, 'person_1');
    const p2 = assignBuilder(p1, 'person_1');
    expect(p2.assignedWorkerIds.filter(id => id === 'person_1')).toHaveLength(1);
  });

  it('removes person from project worker list', () => {
    const settlement = makeSettlement();
    const { project } = startConstruction(settlement, 'longhouse', null, 1);
    const assigned = assignBuilder(project, 'person_1');
    const removed  = removeBuilder(assigned, 'person_1');
    expect(removed.assignedWorkerIds).not.toContain('person_1');
  });
});

// ─── processConstruction ─────────────────────────────────────────────────────

describe('processConstruction', () => {
  it('makes no progress when no workers assigned', () => {
    const settlement = makeSettlement();
    const { project } = startConstruction(settlement, 'granary', null, 1);
    // Granary costs 1 season (100 points)
    const people = makePeople(1);
    const rng = createRNG(1);
    const result = processConstruction([project], people, 2, rng);
    expect(result.updatedQueue).toHaveLength(1);
    expect(result.updatedQueue[0].progressPoints).toBe(0);
    expect(result.completedBuildings).toHaveLength(0);
  });

  it('advances progress with one worker (longhouse — 2 seasons, stays in queue)', () => {
    const settlement = makeSettlement();
    const { project } = startConstruction(settlement, 'longhouse', null, 1);
    const people = makePeople(1);
    const [personId] = people.keys();
    const withWorker = assignBuilder(project, personId);

    const rng = createRNG(1);
    const result = processConstruction([withWorker], people, 2, rng);
    // Longhouse needs 200 points; 1 worker produces ~125 points → still in queue
    expect(result.updatedQueue).toHaveLength(1);
    expect(result.updatedQueue[0].progressPoints).toBeGreaterThan(0);
  });

  it('completes a 1-season project in one pass', () => {
    const settlement = makeSettlement();
    const { project } = startConstruction(settlement, 'granary', null, 1);
    // Assign 2 workers to guarantee completion in 1 season
    const people = makePeople(2);
    const ids = Array.from(people.keys());
    let proj = assignBuilder(project, ids[0]);
    proj = assignBuilder(proj, ids[1]);

    const rng = createRNG(42);
    const result = processConstruction([proj], people, 2, rng);
    expect(result.completedBuildings).toHaveLength(1);
    expect(result.completedBuildings[0].defId).toBe('granary');
    expect(result.updatedQueue).toHaveLength(0);
    // Workers should be freed
    expect(result.completedWorkerIds).toContain(ids[0]);
    expect(result.completedWorkerIds).toContain(ids[1]);
  });

  it('removes replaced building when upgrade completes', () => {
    // Longhouse replaces camp — check removedBuildingIds
    const settlement = makeSettlement();
    const { project } = startConstruction(settlement, 'longhouse', null, 1);
    const people = makePeople(5);
    const ids = Array.from(people.keys());
    let proj = project;
    for (const id of ids) proj = assignBuilder(proj, id);

    const rng = createRNG(99);
    // Need multiple seasons for longhouse (200 points); push progress manually
    const fastProj = { ...proj, progressPoints: 190, totalPoints: 200 };
    const result = processConstruction([fastProj], people, 2, rng);
    expect(result.completedBuildings).toHaveLength(1);
    expect(result.removedBuildingIds).toContain('camp');
  });
});

// ─── cancelConstruction ──────────────────────────────────────────────────────

describe('cancelConstruction', () => {
  it('returns 50% refund of spent resources', () => {
    const settlement = makeSettlement();
    const { project } = startConstruction(settlement, 'longhouse', null, 1);
    // Longhouse: 15 lumber + 5 stone
    const { refund } = cancelConstruction(project);
    expect(refund['lumber']).toBe(7); // floor(15 * 0.5)
    expect(refund['stone']).toBe(2);  // floor(5 * 0.5)
  });

  it('frees assigned workers', () => {
    const settlement = makeSettlement();
    const { project } = startConstruction(settlement, 'longhouse', null, 1);
    const assigned = assignBuilder(project, 'person_a');
    const { freedWorkerIds } = cancelConstruction(assigned);
    expect(freedWorkerIds).toContain('person_a');
  });

  it('handles no-cost buildings gracefully', () => {
    // camp costs nothing; cancel of a hypothetical zero-cost project
    const fakeProject = {
      id: 'proj_0',
      defId: 'camp' as const,
      style: null,
      progressPoints: 0,
      totalPoints: 0,
      assignedWorkerIds: [],
      startedTurn: 0,
      resourcesSpent: {},
    };
    const { refund } = cancelConstruction(fakeProject);
    expect(Object.values(refund).every(v => v === 0)).toBe(true);
  });
});
