# Enchantaholic — Branding

**Tagline:** *Break a block. Get enchanted. Never stop.*
Alt: *Sharpness VI is just the beginning.*

## CurseForge description

> **Enchantaholic** turns every swing into a lottery. Each block you break adds a **random enchantment to a random item in your inventory**, and levels **keep stacking past vanilla caps**: Sharpness VI, Efficiency XII, Protection XXX. Dig a tunnel and you come out with a god-tier sword and a pair of boots you can't explain. The mode is a toggle on the world-creation screen, saved with the world, and operators can flip it any time with `/enchantaholic on|off`, so you can switch it on in any world. Each player can mute the enchant sound, the actionbar message, or both. Want more chaos? Switch on **11 custom enchantments** (Vein Miner, Barrage, Yeet, Kaboom, Magnet, Moon Boots and more, plus two curses) and they roll onto anything, even a stick. There's a **Fabric mod for Java 26.2–26.3** and a **Bedrock behavior pack** (26.50+; activate the pack, toggle with `/enchantaholic:toggle`).

## Features
- ⛏️ **Every block counts:** each break enchants a random item in your inventory.
- 📈 **Past the caps:** levels stack beyond vanilla limits (VI, VII … up to CCLV on Java; on Bedrock the true level is tracked in lore, with real bonuses for Sharpness, Smite, Bane, Power, the Protection family and Efficiency).
- 🎲 **Fully random:** any item, any enchantment (Bedrock only rolls pairs the game accepts). The chaos is the point.
- ⚙️ **Toggle anywhere:** an ON/OFF button at world creation plus an operator command (`/enchantaholic`) for existing worlds and servers (Java); an operator command on Bedrock.
- ✨ **Custom enchantments (optional, off by default):** Vein Miner, Barrage, Yeet, Kaboom, Party Popper, Chicken Rain, Midas Touch, Magnet, Moon Boots, Curse of Butterfingers and Curse of Hiccups. They land on any item, stack past I, and every effect has a safety cap (Kaboom never breaks blocks, Barrage copies can't be picked up). Java: the **Custom Enchantments** button at world creation or `/enchantaholic custom on|off`; Bedrock: `/enchantaholic:custom on|off`.
- 💬 **Clear feedback:** an actionbar message shows what just got enchanted.
- 🔕 **Your call on noise:** turn the enchant sound, the actionbar message, or both off (Mod Menu or /enchantaholic-notify on Java; /enchantaholic:notify on Bedrock).
- 🔢 **Readable numerals:** tooltips show proper Roman numerals up to 255, not `enchantment.level.11`.
- 🧱 **Java + Bedrock:** a Fabric mod (26.2–26.3) and a Bedrock behavior pack.

## Color palette
| Role | Hex |
|---|---|
| Background, deep purple | `#26103C` |
| Background, darkest / border | `#140822` |
| Ink / outline | `#180A28` |
| Frame purple | `#783CBE` |
| Glint purple | `#BE5AFF` |
| Sparkle lilac | `#D696FF` |
| Diamond light | `#A0F8EC` |
| Diamond mid | `#4AD0C4` |
| Diamond dark | `#289696` |
| Level gold | `#FFD640` |
| Level gold shade | `#B07010` |
| Bonus green (+) | `#80FF40` |
| Handle wood | `#A0703A` / `#60401E` |

In-game text: use `§d` (light purple) for the ✦ and the item name, and `§b` (aqua) or `§6` (gold) for the enchantment + level.

## Player-facing strings (en_us)
| Key | Text |
|---|---|
| `enchantaholic.createWorld.toggle` | Enchantaholic Mode |
| `enchantaholic.createWorld.toggle.tooltip` | Every block you break adds a random enchantment to a random item in your inventory. Levels keep stacking past the normal caps (Sharpness VI, VII, and beyond). Saved with this world. Operators can change it later with /enchantaholic on\|off. |
| `enchantaholic.command.on` | Enchantaholic Mode is now ON for this world |
| `enchantaholic.command.off` | Enchantaholic Mode is now OFF for this world |
| `enchantaholic.command.status.on` | Enchantaholic Mode is ON in this world |
| `enchantaholic.command.status.off` | Enchantaholic Mode is OFF in this world |
| `enchantaholic.createWorld.customToggle` | Custom Enchantments |
| `enchantaholic.createWorld.customToggle.tooltip` | Adds 11 fun Enchantaholic enchantments (Vein Miner, Barrage, Kaboom, Magnet, two curses…) to the random pool, and turns their effects on. Saved with this world. Operators can change it later with /enchantaholic custom on\|off. |
| `enchantaholic.command.custom.on` | Custom Enchantments are now ON for this world |
| `enchantaholic.command.custom.off` | Custom Enchantments are now OFF for this world |
| `enchantaholic.command.custom.status.on` | Custom Enchantments are ON in this world |
| `enchantaholic.command.custom.status.off` | Custom Enchantments are OFF in this world |
| `enchantaholic.message.enchanted` | `✦ %1$s → %2$s` |
| `enchantaholic.settings.title` | Enchantaholic Settings |
| `enchantaholic.settings.notifySound` | Enchant sound |
| `enchantaholic.settings.notifySound.tooltip` | Play a quiet chime when one of your items gets enchanted. |
| `enchantaholic.settings.notifyMessage` | Enchant message |
| `enchantaholic.settings.notifyMessage.tooltip` | Show the actionbar message (✦ item → enchantment) when one of your items gets enchanted. |
| `enchantaholic.command.notify.sound` | Enchant sound: %s |
| `enchantaholic.command.notify.message` | Enchant message: %s |

**Custom enchantment names and descriptions** (`enchantment.enchantaholic.<id>` and `enchantment.enchantaholic.<id>.desc`, the Enchantment Descriptions convention). Curses are styled red through `#minecraft:curse`.

| id | Name | `.desc` |
|---|---|---|
| `vein_miner` | Vein Miner | Breaks connected blocks of the same type along with the one you mine. |
| `barrage` | Barrage | Fires a volley of extra projectiles that can't be picked up. |
| `yeet` | Yeet | Hits launch targets up and away. |
| `kaboom` | Kaboom | Projectiles explode on impact without breaking blocks. |
| `party_popper` | Party Popper | Kills set off fireworks. |
| `chicken_rain` | Chicken Rain | Mined blocks sometimes release a chicken. |
| `midas_touch` | Midas Touch | Mined blocks sometimes drop gold. |
| `magnet` | Magnet | Pulls nearby items and experience toward you. |
| `moon_boots` | Moon Boots | Higher jumps and no fall damage. |
| `butterfingers` | Curse of Butterfingers | Sometimes drops the held item when you hit or mine. |
| `hiccups` | Curse of Hiccups | Every now and then you hop involuntarily. |

**Enchant message:** show it on the **actionbar** (`player.displayClientMessage(msg, true)`) so fast mining doesn't flood chat. Example: `✦ Diamond Pickaxe → Efficiency VI`.
- `%1$s` = the item's hover name (`stack.getHoverName()`), styled light purple.
- `%2$s` = `Enchantment.getFullname(holder, level)`, which uses `enchantment.level.N` and so picks up the numerals below. Style it aqua. Curses stay red, since vanilla already styles them.
- Build it with `Component.translatable("enchantaholic.message.enchanted", itemName, enchName)` rather than concatenating strings.
- Optional: a `§6(+1)` suffix, or a level-up chime (`ENCHANTMENT_TABLE_USE` at low volume).

## Roman numerals past X
Vanilla only translates `enchantment.level.1` through `enchantment.level.10`. From 11 upward the tooltip shows the raw key (`enchantment.level.11`). `en_us.json` includes `enchantment.level.11` to `enchantment.level.255`, generated and checked in code (XI … CCLV). If levels can go above 255, the mod should fall back to plain digits. One way is a mixin on `Enchantment.getFullname` that uses `Component.translatableWithFallback("enchantment.level." + n, String.valueOf(n))`.

## Bedrock
- `texts/en_US.lang`: `pack.name` / `pack.description`. In `manifest.json`, set `"name": "pack.name"` and `"description": "pack.description"`.
- `texts/languages.json`: `["en_US"]`
- `pack_icon.png` (256×256, opaque) goes in the pack root.
- Bedrock can't add custom game rules. The pack uses a Script API custom command, `/enchantaholic:toggle [on|off|status]` (operators, works with cheats off), stores the state in the world dynamic property `enchantaholic:enabled`, and reuses the "Enchantaholic Mode" name in its messages.
- Notifications: `/enchantaholic:notify <sound|message|status> [on|off]` lets any player (no operator rights, works with cheats off) turn their enchant sound or actionbar message off or on. The choice is stored per player in the player dynamic property `enchantaholic:notify` (JSON `{"sound":true,"message":true}`; missing means both on).
- Custom enchantments: `/enchantaholic:custom <on|off|status>` (operators, works with cheats off), stored in the world dynamic property `enchantaholic:custom` (missing means off). Replies: `Custom Enchantments are now §aON§r for this world` / `§cOFF§r`, status `Custom Enchantments: §aON` / `§cOFF`. Turning customs on while the mode is off adds `§7(Enchantaholic Mode is §cOFF§7, so nothing will roll until you turn it on with /enchantaholic:toggle on)`. On items, a custom level is a lore line after the vanilla overcap lines: `§9<Name> <Roman>` (blue), `§c` for curses, behind the same invisible tag as the overcap lines. The actionbar uses `§b` for the enchantment (curses `§c`), as for vanilla ones.
