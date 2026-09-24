# Enchantaholic — Branding

**Tagline:** *Break a block. Get enchanted. Never stop.*
Alt: *Sharpness VI is just the beginning.*

## CurseForge description

> **Enchantaholic** turns every swing into a lottery. Each block you break adds a **random enchantment to a random item in your inventory**, and levels **keep stacking past vanilla caps**: Sharpness VI, Efficiency XII, Protection XXX. Dig a tunnel and you come out with a god-tier sword and a pair of boots you can't explain. The mode is a toggle on the world-creation screen and a game rule (`/gamerule enchantaholic:enchantaholic true`), so you can switch it on in any world. There's a **Fabric mod for Java 26.2–26.3** and a **Bedrock behavior pack** (26.50+; activate the pack, toggle with `/enchantaholic:toggle`).

## Features
- ⛏️ **Every block counts:** each break enchants a random item in your inventory.
- 📈 **Past the caps:** levels stack beyond vanilla limits (VI, VII … up to CCLV on Java; on Bedrock the true level is tracked in lore, with real bonuses for Sharpness, Smite, Bane, Power, the Protection family and Efficiency).
- 🎲 **Fully random:** any item, any enchantment (Bedrock only rolls pairs the game accepts). The chaos is the point.
- ⚙️ **Toggle anywhere:** an ON/OFF button at world creation plus a game rule for existing worlds (Java); an operator command on Bedrock.
- 💬 **Clear feedback:** an actionbar message shows what just got enchanted.
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
| `gamerule.enchantaholic.enchantaholic` | Enchantaholic Mode |
| `gamerule.enchantaholic.enchantaholic.description` | Every block you break enchants a random item in your inventory. Levels stack past vanilla limits. |
| `enchantaholic.createWorld.toggle` | Enchantaholic Mode |
| `enchantaholic.createWorld.toggle.tooltip` | Every block you break adds a random enchantment to a random item in your inventory. Levels keep stacking past the normal caps (Sharpness VI, VII, and beyond). You can change this later with /gamerule enchantaholic:enchantaholic. |
| `enchantaholic.message.enchanted` | `✦ %1$s → %2$s` |

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
