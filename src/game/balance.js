// Master balance data — single source of numeric truth.
// Derived from docs/design/balance.md v1.0 (adapted for the v1 build:
// upgrades/tech-tree deferred, vineyard added, dairy/shack/cistern cut).
export const BALANCE = {
  time: {
    dayLength: 150,           // seconds per in-game day
    weekDays: 7, shabbatDay: 0, // day % 7 === 0 -> Shabbat
    shabbatEndHour: 20,       // motzaei shabbat
    nightFromHour: 19, nightToHour: 5,
  },

  resources: {
    baseCaps: { wood: 100, stone: 80, food: 60, water: 40, shekels: 99999 },
    ratesPerMin: {
      woodcutter: 9, stoneGatherer: 6,
      waterPerTrip: 10, donkeyWaterPerTrip: 20, springFill: 3,
      vegPatch: 5, vineyard: 2.5,
      flockBase: 7, flockBaseSheep: 4, flockPerExtraSheep: 1.5,
      junctionTripShekels: 25, junctionWaitS: 45,
    },
    consumptionPerMin: {
      settlerFood: 0.4, settlerWater: 0.4,
      dogFood: 0.2, sheepWater: 0.08, vegPatchWater: 1.2,
    },
    starvation: { spiritPerMin: -3, workSpeedMult: 0.8 },
  },

  buildings: {
    tent:        { cost: { wood: 15 }, buildS: 10, hp: 60,  pop: 1, unlockCh: 1, w: 2, h: 2 },
    caravan:     { cost: { wood: 40, stone: 20, shekels: 60 }, buildS: 30, hp: 300, pop: 2, unlockCh: 1, core: true, w: 2, h: 4 },
    sheep_pen:   { cost: { wood: 30, stone: 10 }, buildS: 25, hp: 140, sheepCap: 12, unlockCh: 1, w: 4, h: 4 },
    veg_patch:   { cost: { wood: 10, water: 5 }, buildS: 12, hp: 60, workerSlots: 1, foodPerMin: 5, unlockCh: 1, w: 2, h: 3 },
    campfire:    { cost: { wood: 10, stone: 5 }, buildS: 10, hp: 60, spiritAuraR: 9, spiritPerMin: 0.5, unlockCh: 1, w: 2, h: 2 },
    fence:       { cost: { wood: 5 }, buildS: 5, hp: 60, unlockCh: 2, w: 1, h: 1, fence: true },
    pergola:     { cost: { wood: 20 }, buildS: 15, hp: 70, mealSpirit: 1, unlockCh: 2, w: 2, h: 2 },
    synagogue:   { cost: { wood: 30, stone: 15 }, buildS: 30, hp: 160, shabbatLump: 10, unlockCh: 2, w: 2, h: 3 },
    kennel:      { cost: { wood: 25, food: 10 }, buildS: 20, hp: 90, dogSlots: 2, interceptR: 17, unlockCh: 2, w: 1, h: 2 },
    zula:        { cost: { wood: 20 }, buildS: 15, hp: 70, unlockCh: 3, w: 2, h: 2 },
    vineyard:    { cost: { wood: 15, water: 10 }, buildS: 15, hp: 70, foodPerMin: 2.5, unlockCh: 5, w: 2, h: 4, crops: true },
    container:   { cost: { wood: 60, stone: 30, shekels: 80 }, buildS: 45, hp: 260, capBonus: { wood: 150, stone: 120, food: 100 }, unlockCh: 4, w: 2, h: 4 },
    water_tower: { cost: { wood: 50, stone: 30, shekels: 50 }, buildS: 45, hp: 200, waterCap: 200, unlockCh: 3, w: 2, h: 2 },
    watchtower:  { cost: { wood: 50, stone: 50 }, buildS: 45, hp: 170, damage: 7, cooldownS: 1.6, rangeM: 26, courageDrainPerHit: 6, unlockCh: 5, w: 1, h: 1 },
    generator:   { cost: { wood: 20, shekels: 90 }, buildS: 30, hp: 110, lightR: 16, courageDrainPerS: 6, unlockCh: 5, w: 1, h: 2 },
  },
  buildingRules: {
    dismantleRefundFrac: 0.7, newBuildingGraceS: 30, maxSlope: 0.38,
  },

  units: {
    settler: { hp: 40, damage: 4, cooldownS: 1.0, rangeM: 1.6, speed: 3.2, visionM: 20, courageDrainPerHit: 6 },
    shepherd:{ hp: 50, damage: 12, cooldownS: 1.6, rangeM: 17, speed: 3.2, visionM: 24, courageDrainPerHit: 15, vsBoar: 2 },
    guard:   { hp: 55, damage: 8, cooldownS: 1.0, rangeM: 1.8, speed: 3.4, visionM: 30, courageDrainPerHit: 10 },
    dog:     { hp: 35, damage: 6, cooldownS: 0.6, rangeM: 1.4, speed: 5.6, visionM: 28, barkDrainPerS: 5, barkR: 7, vsAnimal: 2, vsHuman: 0.5 },
    donkey:  { hp: 60, speed: 3.0, visionM: 15 },
    sheep:   { hp: 40, speed: 2.6, visionM: 10, spiritOnLoss: -5 },
  },

  hostiles: {
    jackal: { hp: 20, damage: 3, cooldownS: 1.0, speed: 4.6, fleeHpFrac: 0.5, pts: 1 },
    wolf:   { hp: 35, damage: 7, cooldownS: 1.0, speed: 5.0, fleeHpFrac: 0.4, pts: 2 },
    boar:   { hp: 70, damage: 10, cooldownS: 2.0, speed: 4.2, fleeHpFrac: 0.3, pts: 3 },
    thief:  { hp: 45, damage: 4, cooldownS: 1.0, speed: 3.8, speedCarrying: 2.6, fleeHpFrac: 0.5, pts: 3 },
    raider: { hp: 60, damage: 8, cooldownS: 1.0, speed: 3.4, fleeHpFrac: 0.25, pts: 5, dismantleDps: 8 },
    leader: { hp: 110, damage: 10, cooldownS: 1.0, speed: 3.4, fleeHpFrac: 0.2, pts: 10, routAura: 40 },
  },
  courage: {
    max: 100,
    dogBarkPerS: 4.5, slingHit: 15, generatorLightPerS: 5,
    defenderInSightPerS: 1.8, defenderSightCap: 5, bellCrowdPerS: 5,
  },

  waves: {
    telegraphS: 25,
    grace: { chapterStartS: 100, postWaveS: 50 },
    unitCount: { maxPerWave: 16, mapHostileCap: 22 },
    rewards: { waveSurvivedSpirit: 4, zeroLossSpirit: 2 },
    rubberBand: { min: 0.75, max: 1.35 },
    freePlay: {
      nuisanceEveryDays: 3,
      nuisance: (week) => 3 + week * 2,
      bigRaidEveryDays: 9,
      bigRaid: (n) => Math.min(55, Math.round(9 * Math.pow(1.25, n))),
    },
  },

  spirit: {
    driftPerMin: -1.0,
    shabbat: 30, shabbatSynagogue: 40,
    kumzitz: 10, kumzitzMotzash: 15, kumzitzWoodCost: 10,
    waveSurvived: 5, zeroLoss: 3, buildingComplete: 2, newSettler: 5,
    sheepLost: -5, structureDestroyed: -8,
    demolitionArrival: -10, selfDismantle: -8, demolitionIgnored: -20,
    musterCost: 25, musterMinSpirit: 25, musterVictory: 10,
    campfireAuraPerMin: 0.5,
    thresholds: [
      { min: 80, workSpeedMult: 1.15 },
      { min: 50, workSpeedMult: 1.0 },
      { min: 25, workSpeedMult: 0.9 },
      { min: 0, workSpeedMult: 0.75 },
    ],
  },

  demolition: {
    countdownDays: 3, arrivalSpirit: -10,
    dismantleRefundFrac: 0.85,
    muster: { spiritCost: 25, minSpirit: 25, busArrivesAfterS: 45, victorySpirit: 10 },
    ignored: { refundFrac: 0, spirit: -20 },
  },

  recruit: { minSpirit: 50, hitchhikerEveryDays: 2.5 },
};

export function spiritWorkMult(spirit) {
  for (const t of BALANCE.spirit.thresholds) if (spirit >= t.min) return t.workSpeedMult;
  return 0.75;
}
