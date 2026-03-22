import { describe, it, expect } from 'vitest';
import { applyBuildingMaintenance } from '../../src/simulation/buildings/building-effects';
import type { BuiltBuilding } from '../../src/simulation/turn/game-state';
import type { ResourceStock } from '../../src/simulation/turn/game-state';

// Minimal BuiltBuilding helper
function makeBuilding(
  defId: BuiltBuilding['defId'],
  instanceId: string,
  overrides: Partial<BuiltBuilding> = {},
): BuiltBuilding {
  return {
    defId,
    instanceId,
    builtTurn: 1,
    style: null,
    claimedByPersonIds: [],
    ownerHouseholdId: null,
    assignedWorkerIds: [],
    neglected: false,
    ...overrides,
  };
}

function makeResources(overrides: Partial<ResourceStock> = {}): ResourceStock {
  return {
    food: 0, cattle: 0, wealth: 0, steel: 0, lumber: 0,
    stone: 0, medicine: 0, horses: 0,
    ...overrides,
  };
}

describe('applyBuildingMaintenance', () => {
  it('building with no maintenanceCost is unchanged and not neglected', () => {
    // camp has no maintenanceCost in the catalog
    const building = makeBuilding('camp', 'camp_0');
    const resources = makeResources({ wealth: 5 });
    const { updatedBuildings, updatedResources, neglectedIds } = applyBuildingMaintenance(
      [building],
      resources,
    );
    expect(neglectedIds).toHaveLength(0);
    expect(updatedResources.wealth).toBe(5); // unchanged
    expect(updatedBuildings[0].neglected).toBe(false);
  });

  it('building with no maintenanceCost clears neglected flag if it was set', () => {
    const building = makeBuilding('camp', 'camp_0', { neglected: true });
    const resources = makeResources({ wealth: 0 });
    const { updatedBuildings, neglectedIds } = applyBuildingMaintenance([building], resources);
    expect(neglectedIds).toHaveLength(0);
    expect(updatedBuildings[0].neglected).toBe(false);
  });

  it('building with maintenance cost that can be paid: deducts cost and clears neglected', () => {
    // workshop costs { wealth: 1 }
    const building = makeBuilding('workshop', 'workshop_0', { neglected: true });
    const resources = makeResources({ wealth: 3 });
    const { updatedBuildings, updatedResources, neglectedIds } = applyBuildingMaintenance(
      [building],
      resources,
    );
    expect(neglectedIds).toHaveLength(0);
    expect(updatedResources.wealth).toBe(2);
    expect(updatedBuildings[0].neglected).toBe(false);
  });

  it('building that can pay keeps neglected: false when it was already not neglected', () => {
    const building = makeBuilding('workshop', 'workshop_0', { neglected: false });
    const resources = makeResources({ wealth: 5 });
    const { updatedBuildings } = applyBuildingMaintenance([building], resources);
    expect(updatedBuildings[0].neglected).toBe(false);
  });

  it('building with maintenance cost it cannot pay: marks neglected', () => {
    const building = makeBuilding('workshop', 'workshop_0');
    const resources = makeResources({ wealth: 0 }); // cannot afford wealth: 1
    const { updatedBuildings, updatedResources, neglectedIds } = applyBuildingMaintenance(
      [building],
      resources,
    );
    expect(neglectedIds).toContain('workshop_0');
    expect(updatedResources.wealth).toBe(0); // not deducted
    expect(updatedBuildings[0].neglected).toBe(true);
  });

  it('processes multiple buildings: pays what it can, neglects the rest', () => {
    // workshop: { wealth: 1 }, trading_post: { wealth: 2 }
    const b1 = makeBuilding('workshop', 'workshop_0');
    const b2 = makeBuilding('trading_post', 'trading_post_0');
    const resources = makeResources({ wealth: 1 }); // enough for workshop, not trading_post
    const { updatedBuildings, updatedResources, neglectedIds } = applyBuildingMaintenance(
      [b1, b2],
      resources,
    );
    expect(neglectedIds).not.toContain('workshop_0');
    expect(neglectedIds).toContain('trading_post_0');
    expect(updatedResources.wealth).toBe(0);
    expect(updatedBuildings[0].neglected).toBe(false);
    expect(updatedBuildings[1].neglected).toBe(true);
  });

  it('palisade costs lumber: deducts lumber, not wealth', () => {
    // palisade has maintenanceCost: { lumber: 2 }
    const building = makeBuilding('palisade', 'palisade_0');
    const resources = makeResources({ lumber: 5, wealth: 10 });
    const { updatedResources, neglectedIds } = applyBuildingMaintenance([building], resources);
    expect(neglectedIds).toHaveLength(0);
    expect(updatedResources.lumber).toBe(3);
    expect(updatedResources.wealth).toBe(10); // unchanged
  });

  it('palisade with no lumber is marked neglected', () => {
    const building = makeBuilding('palisade', 'palisade_0');
    const resources = makeResources({ lumber: 0, wealth: 10 });
    const { neglectedIds } = applyBuildingMaintenance([building], resources);
    expect(neglectedIds).toContain('palisade_0');
  });

  it('already-neglected building that can now pay has neglected cleared', () => {
    const building = makeBuilding('workshop', 'workshop_0', { neglected: true });
    const resources = makeResources({ wealth: 5 });
    const { updatedBuildings, neglectedIds } = applyBuildingMaintenance([building], resources);
    expect(neglectedIds).toHaveLength(0);
    expect(updatedBuildings[0].neglected).toBe(false);
  });

  it('empty building list returns unchanged resources', () => {
    const resources = makeResources({ wealth: 10 });
    const { updatedBuildings, updatedResources, neglectedIds } = applyBuildingMaintenance(
      [],
      resources,
    );
    expect(updatedBuildings).toHaveLength(0);
    expect(neglectedIds).toHaveLength(0);
    expect(updatedResources.wealth).toBe(10);
  });

  it('multi-resource cost: both resources checked; partially affordable still neglects', () => {
    // bathhouse has maintenanceCost: { wealth: 2, stone: 1 }
    const building = makeBuilding('bathhouse', 'bathhouse_0');
    // Enough wealth but no stone
    const resources = makeResources({ wealth: 5, stone: 0 });
    const { neglectedIds, updatedResources } = applyBuildingMaintenance([building], resources);
    expect(neglectedIds).toContain('bathhouse_0');
    expect(updatedResources.wealth).toBe(5); // no deduction
    expect(updatedResources.stone).toBe(0);
  });

  it('multi-resource cost paid when both resources available', () => {
    const building = makeBuilding('bathhouse', 'bathhouse_0');
    const resources = makeResources({ wealth: 5, stone: 3 });
    const { neglectedIds, updatedResources } = applyBuildingMaintenance([building], resources);
    expect(neglectedIds).toHaveLength(0);
    expect(updatedResources.wealth).toBe(3);
    expect(updatedResources.stone).toBe(2);
  });
});
