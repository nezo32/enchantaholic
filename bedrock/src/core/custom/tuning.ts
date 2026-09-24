/** Tuning constants and safety caps of the custom enchantment effects. Pure: no @minecraft/* imports. */

// Vein Miner: 8 extra blocks per level, at most 256; 32 blocks per job per tick; at most 8 jobs at once.
export const VEIN_PER_LEVEL = 8;
export const VEIN_MAX_BLOCKS = 256;
export const VEIN_BLOCKS_PER_TICK = 32;
export const VEIN_MAX_JOBS = 8;

// Barrage: 10 copies per level, at most 64 per shot, ±10° spread; copies live at most 200 ticks.
export const BARRAGE_PER_LEVEL = 10;
export const BARRAGE_MAX_COPIES = 64;
export const BARRAGE_SPREAD_DEG = 10;
export const COPY_LIFETIME_TICKS = 200;
export const MAX_TRACKED_COPIES = 1024;

// Kaboom: power 1 + 0.5 per level, at most 8; at most 16 explosions per tick.
export const KABOOM_BASE = 1;
export const KABOOM_PER_LEVEL = 0.5;
export const KABOOM_MAX_POWER = 8;
export const KABOOM_MAX_PER_TICK = 16;
export const MAX_TRACKED_KABOOM = 512;

// Yeet: horizontal and vertical knockback strength.
export const YEET_H_BASE = 0.8;
export const YEET_H_PER_LEVEL = 0.4;
export const YEET_H_MAX = 4;
export const YEET_V_BASE = 0.5;
export const YEET_V_PER_LEVEL = 0.3;
export const YEET_V_MAX = 3;

// Party Popper: one rocket per level, at most 16, one every 2 ticks.
export const PARTY_MAX_FIREWORKS = 16;
export const PARTY_TICKS_BETWEEN = 2;

// Chicken Rain: 5 % per level; no spawn when 32 chickens are within 16 blocks.
export const CHICKEN_PCT_PER_LEVEL = 5;
export const CHICKEN_LOCAL_CAP = 32;
export const CHICKEN_CAP_RADIUS = 16;

// Midas Touch: 3 % per level.
export const MIDAS_PCT_PER_LEVEL = 3;

// Magnet: radius 3 + level, at most 24; every 10 ticks; at most 64 entities per player.
export const MAGNET_BASE_RADIUS = 3;
export const MAGNET_MAX_RADIUS = 24;
export const MAGNET_INTERVAL_TICKS = 10;
export const MAGNET_MAX_PER_PLAYER = 64;
export const MAGNET_PULL = 0.6;

// Moon Boots: Jump Boost refreshed every 10 ticks; amplifier at most 10.
export const MOON_INTERVAL_TICKS = 10;
export const MOON_DURATION_TICKS = 30;
export const MOON_MAX_AMPLIFIER = 10;

// Curse of Butterfingers: 2 % per level, at most 50 %.
export const BUTTER_PCT_PER_LEVEL = 2;
export const BUTTER_MAX_PCT = 50;

// Curse of Hiccups: rolled every 200 ticks, 3 % per level, at most 60 %.
export const HICCUP_INTERVAL_TICKS = 200;
export const HICCUP_PCT_PER_LEVEL = 3;
export const HICCUP_MAX_PCT = 60;
export const HICCUP_HOP = 0.35;

/** Entity tags: barrage copies and items dropped by Butterfingers. */
export const COPY_TAG = "enchantaholic:copy";
export const FUMBLE_TAG = "enchantaholic:fumble";
