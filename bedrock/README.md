# Enchantaholic for Bedrock

This is the Bedrock Edition version of [Enchantaholic](../README.md), built as a behavior pack that uses the Script API
(`@minecraft/server` 2.10.0, no experiments). It needs Bedrock **26.50 or newer** (`min_engine_version` 1.26.50).

With the pack active, each block you break adds one random enchantment level to a random item in your inventory.

## Install

1. Download `enchantaholic-<version>.mcaddon` from the
   [GitHub releases](https://github.com/nezo32/enchantaholic/releases) or from CurseForge.
2. Open the file (double-click, or "Open with" Minecraft). Minecraft imports it.
3. Create a world. Under **Behavior Packs**, activate **Enchantaholic**. The mode is on as soon as the world loads.

You can also add the pack to an existing world the same way. Every build also produces an `enchantaholic-<version>.mcpack`
file in `dist/`, but releases attach only the `.mcaddon`.

> Activating any behavior pack **disables achievements** for that world. Minecraft does this for every behavior pack,
> and the pack cannot change it.

## How it works

- **Trigger:** a player breaks a block. Nothing happens in Creative or Spectator mode, or when the block breaks
  instantly (hardness 0: grass, flowers, torches, redstone dust, TNT and so on).
- **Item:** one non-empty slot, picked uniformly from the 36 inventory slots (hotbar included), the four armor slots
  and the offhand.
- **Enchantment:** any enchantment, curses included, that is compatible with the item or already on it. `Lunge` goes only
  on spears. When the item can't take any enchantment, another slot is picked. When no item fits, nothing happens.
- **Stacking:** the enchantment's level goes up by 1 (a new one starts at I). There is no upper limit.
- **Feedback:** an actionbar message such as `✦ Diamond Pickaxe → Efficiency VI`, plus a quiet sound. Each player can turn either off with `/enchantaholic:notify`.

### Levels above the vanilla maximum

Bedrock won't store an enchantment above its vanilla maximum. The real enchantment therefore stops at the max (for
example Sharpness V). The **true level** is saved in a dynamic property on the item and in a lore line, such as
`Sharpness VIII`. Stackable items (books, for example) have no dynamic properties, so the lore line alone holds their
true level.

Levels above the max have a gameplay effect only for these enchantments:

| Enchantment | Bonus per level above max |
|---|---|
| Sharpness | +1.25 melee damage |
| Smite / Bane of Arthropods | +2.5 melee damage against undead / arthropods |
| Power | +10% arrow damage |
| Protection, Fire / Blast / Projectile Protection, Feather Falling | Extra damage reduction for matching damage types. The reduction grows smoothly and never reaches 100% |
| Efficiency | Haste while the tool is held (one level above max gives Haste I, up to Haste X) |

For every other enchantment, a level above the max is shown in lore and on the actionbar and does nothing in gameplay.
These bonuses stay active when the mode is switched off.

When a grindstone or anvil removes an enchantment or lowers it below its max, its stored extra level is dropped.

## Command

```
/enchantaholic:toggle [on|off|status]
```

| Usage | Effect |
|---|---|
| `/enchantaholic:toggle` | Switches the mode (on to off, off to on) |
| `/enchantaholic:toggle on` / `off` | Turns the mode on or off |
| `/enchantaholic:toggle status` | Shows `Enchantaholic Mode: ON` or `OFF` |

- Only operators and command blocks can run it. It works in worlds with cheats off.
- The state is saved in the world (dynamic property `enchantaholic:enabled`) and survives reloads. A new world starts ON.
- A change is announced in chat to every player.

### Notifications (any player)

```
/enchantaholic:notify <sound|message|status> [on|off]
```

| Usage | Effect |
|---|---|
| `/enchantaholic:notify status` | Shows your current settings |
| `/enchantaholic:notify sound off` / `on` | Turns your enchant sound off or on |
| `/enchantaholic:notify message off` / `on` | Turns your actionbar message off or on |
| `/enchantaholic:notify sound` / `message` | Switches that setting |

Every player can use it, and it works with cheats off. Settings are per player (dynamic property `enchantaholic:notify`
on the player) and are kept across sessions. Both are on by default.

## Limitations

- Real enchantment levels stop at the vanilla maximum. Levels above it matter in gameplay only for the enchantments in
  the table above.
- The pack never forces an enchantment onto an item that can't take it. It picks another enchantment or another item
  instead. The Java mod can put any enchantment on any item.
- Bedrock has no custom game rules and no world-creation toggle. Activating the pack turns the mode on, and the command
  switches it.
- Achievements are disabled in worlds that use the pack. This is Minecraft's rule for behavior packs.
- The Power bonus uses the bow you are holding when the arrow hits, not when you shot it.
- Some of these behaviors are still waiting for in-game confirmation (see the manual checklist below): whether edited
  damage values take effect, and how plain books and enchanted books behave.

## Development

Requirements: Node 22 or newer (CI uses Node 24).

```bash
cd bedrock
npm ci
npm run typecheck      # tsc for src and tests
npm run lint           # eslint
npm test               # vitest (unit tests, fakes for @minecraft/server, bundle and manifest checks)
npm run build          # esbuild bundle → build/Enchantaholic_BP
npm run package        # build + dist/enchantaholic-<version>.mcaddon and .mcpack
DEBUG=1 npm run build  # debug build (logs skipped block ids to the content log)
npm run clean          # remove build/ and dist/
```

`VERSION=1.2.3 npm run package` stamps a version into the manifest and the file names. Leave the versions in
`pack/manifest.json` and `package.json` as they are: the release tag sets the real version (see
[docs/ci/RELEASING.md](../docs/ci/RELEASING.md)).

Layout:

| Path | Contents |
|---|---|
| `src/core/` | Pure logic: slot and enchantment selection, level math, lore and Roman numerals, bonus formulas. Must not import `@minecraft/*` (ESLint and a test enforce this) |
| `src/adapters/` | Code that calls the game: events, inventory, enchanting, the commands, per-player notification settings, bonus effects |
| `src/main.ts` | Entry point |
| `pack/` | `manifest.json`, `pack_icon.png`, `texts/` |
| `test/` | vitest suites and the `@minecraft/server` fake |
| `scripts/` | Build and packaging (esbuild, reproducible zips) |

## Manual in-game checklist

The automated tests can't run the game, so check these by hand in a new Survival world with the pack active and yourself
as an operator. Use a `DEBUG=1` build.

1. The pack imports, and the content log shows `[Enchantaholic] v<version> loaded`.
2. Breaking stone with an empty inventory does nothing and shows no errors.
3. Mining stone with only a pickaxe enchants the pickaxe and shows the actionbar message.
4. Instant-break blocks (short grass, torch, flower, sapling, slime, honey, TNT, redstone dust, sugar cane) don't
   enchant. Candles, bamboo, vines and snow layers do.
5. Creative and Spectator don't enchant. Adventure with `can_destroy` does.
6. Armor and a shield receive enchantments, armor never gets Sharpness, and curses can appear.
7. Past Sharpness V, the tooltip still shows Sharpness V and a lore line shows VI, VII and so on.
8. A stack of plain books and a single enchanted book either get enchanted or are skipped, with no crash and no
   duplicated items.
9. Lunge appears only on spears.
10. `/enchantaholic:toggle` (status, on, off, no argument) works. A non-operator is refused. The state survives a
    reload. The command works in a world with cheats off.
11. Bonuses above the max: Sharpness VIII deals +3.75 damage compared with Sharpness V, with no double hit sound and no
    extra knockback. Smite affects undead only. Power VII hits harder than Power V. Protection VIII and Feather Falling VI
    reduce fall damage more than the vanilla max. Efficiency VII gives Haste without particles, and the Haste doesn't
    replace a stronger beacon Haste.
12. A grindstone removes the extra level. An anvil rename keeps it.
13. Two players on a dedicated server get enchanted independently. `/reload` doesn't duplicate messages or effects.
    Fast mining with a full inventory causes no lag and no content-log errors.
14. As a non-operator in a world with cheats off, `/enchantaholic:notify status` works. `message off` hides the
    actionbar but keeps the sound, `sound off` silences the chime but keeps the message, and with both off mining still
    enchants silently. The settings survive leaving and rejoining the world, and another player's settings are
    unaffected. A command block running `/enchantaholic:notify status` is refused.
