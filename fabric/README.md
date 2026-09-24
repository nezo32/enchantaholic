# Enchantaholic for Fabric (Java Edition)

This is the Fabric mod for Minecraft Java **26.3** (the default) and **26.2**. For what the mod does and how to install it, see the [root README](../README.md).

## Requirements

- JDK 21 or newer to run Gradle. The build itself compiles with a **Java 25 toolchain**, which Gradle downloads automatically through the foojay resolver. To use a JDK you already have, pass `-Porg.gradle.java.installations.paths=/path/to/jdk-25`.
- Everything else comes from the Gradle wrapper (Gradle 9.5.1, Fabric Loom 1.17, Loader 0.19.5, Fabric API 0.161.0).
- Mod Menu (optional, 21.0.0 for 26.3 / 20.0.2 for 26.2) to open the settings screen. The build only compiles against it (`clientCompileOnly`, from the TerraformersMC maven); it is not bundled and not on the dev/gametest runtime classpath. To try it in `runClient`, drop the matching `modmenu-*.jar` into `run/mods`.

## Build and test

```bash
./gradlew build                          # 26.3: compile + JUnit + server gametests
./gradlew build -Pmod_version=1.2.3      # set the version (default 0.0.0)
./gradlew clean build -Pmc=26.2          # build and test against 26.2 instead
./gradlew test                           # JUnit only (pure core logic + lang file)
./gradlew runGameTest                    # server gametests only (headless)
./gradlew runClient                      # dev client
```

`build/libs/` gets `enchantaholic-<version>.jar`, the jar you ship, and `enchantaholic-<version>-sources.jar`.

The client gametest opens a real client and needs a display. It is not part of `build`:

```bash
timeout 300 xvfb-run -a env LIBGL_ALWAYS_SOFTWARE=1 SDL_VIDEO_FORCE_EGL=1 ./gradlew runClientGameTest   # needs libegl1 libegl-mesa0
```

## Layout

| Path | What it holds |
|---|---|
| `src/main/java/dev/enchantaholic/core/` | Pure selection and level logic. It must not import Minecraft or Fabric classes, and `CorePurityTest` checks this. |
| `src/main/java/dev/enchantaholic/` | Minecraft glue: the per-world mode (`mode/`: SavedData, `/enchantaholic` command, new-world handoff), the block-break hook, the inventory adapter and the feedback. |
| `src/main/java/dev/enchantaholic/net/` | `EnchantedPayload`, the `enchantaholic:enchanted` server-to-client payload that carries the enchant message to clients that have the mod. |
| `src/main/java/dev/enchantaholic/mixin/` | Common mixins: a duck on `LevelStorageSource.LevelStorageAccess` that carries the Create World choice to the integrated server, and a `MinecraftServer` accessor. |
| `src/client/` | The Create World toggle: `GameTabMixin` adds the button, `CreateWorldScreenMixin` holds its value and hands it to the new world. Notification settings: `NotifyConfig` (loads/saves `config/enchantaholic.json` via the pure `core/NotifySettings`), `NotifyClient` (payload receiver), `NotifySettingsScreen`, `ModMenuIntegration` (Mod Menu entrypoint only) and `NotifyCommand` (`/enchantaholic-notify`). |
| `src/test/` | JUnit tests. |
| `src/gametest/` | Server and client gametests. This is a separate test mod, `enchantaholic-gametest`, and it is never packaged. |

## Behavior summary

- Enchantaholic Mode is stored per world in `data/enchantaholic/mode.dat`, off by default. Set it with the Create World → Game button or `/enchantaholic on|off|status` (op level 2). There is no game rule. Worlds from 0.1.0 with the old `enchantaholic:enchantaholic` game rule on are migrated to ON on first load.
- When a survival or adventure player breaks a block that is not instant-break, one random non-empty slot (main inventory, armor or offhand) gets one random enchantment from the whole registry. That enchantment goes up by one level, or is added at level I. Curses and datapack enchantments are included.
- Lunge is only rolled on spears. Enchantments are not checked for compatibility with the item. Levels are capped at 255, the vanilla codec limit.

### Notification settings

- Each enchant shows an actionbar message and plays a quiet chime. Each player can turn either one off, or both. The settings are client-side and per player, stored in `config/enchantaholic.json`: `{"notifySound": true, "notifyMessage": true}`. A missing or broken file means both are on; a broken file is left alone until the next change replaces it.
- With [Mod Menu](https://modrinth.com/mod/modmenu) installed (optional, `suggests`), Mods → Enchantaholic → the config button opens the settings screen (**Enchant sound** / **Enchant message**, saved on every click).
- Without Mod Menu, use the client command `/enchantaholic-notify status`, `/enchantaholic-notify sound|message` (switches it) or `/enchantaholic-notify sound|message on|off`. The root is `enchantaholic-notify`, not `enchantaholic notify`, so it cannot clash with the server's `/enchantaholic` op command.
- This needs the mod on both client and server: when the client has the mod, the server sends only the `enchantaholic:enchanted` payload and the client shows/plays according to its settings. Players who join a server-only install (vanilla client) always get the default actionbar + sound.
- Known limitation: a newer client on a server that runs an **older** Enchantaholic (without the payload) gets the vanilla actionbar + sound from the server, and the client settings have no effect.

## Known quirks at high levels

These are vanilla behaviors and are not patched:

- An enchanted stack no longer merges with plain items of the same kind. The whole stack is enchanted at once.
- At high Efficiency, almost everything breaks instantly. High Sharpness, Power and Breach scale damage linearly.
- Protection reduces damage by at most 80 %.
- Unbreaking 255 makes an item nearly unbreakable.
- Knockback, Punch, Riptide and Wind Burst can launch players very far, sometimes into a fatal fall.
- High Multishot fires hundreds of arrows, which can lag the game.
- **Frost Walker** freezes a disk about level + 2 blocks wide. At very high levels this can hurt server performance near water.
- Extra levels of Mending, Infinity, Silk Touch and similar enchantments only change the name shown.
- Curses of Binding and Vanishing can land on anything.
