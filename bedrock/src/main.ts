import { system, world } from "@minecraft/server";
import { registerCommands } from "./adapters/command";
import { registerEffects } from "./adapters/effects";
import { registerEnchanter } from "./adapters/enchanter";
import { safe } from "./adapters/log";
import { registerNotifyPrefs } from "./adapters/notify-prefs";

// Early execution: only register the custom command. World state is touched after worldLoad.
system.beforeEvents.startup.subscribe(({ customCommandRegistry }) =>
  safe("commands", registerCommands)(customCommandRegistry),
);

world.afterEvents.worldLoad.subscribe(
  safe("load", () => {
    registerEnchanter();
    registerEffects();
    registerNotifyPrefs();
    console.info(`[Enchantaholic] v${__ENCHANTAHOLIC_VERSION__} loaded`);
  }),
);
