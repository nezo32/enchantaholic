package dev.enchantaholic.custom;

import dev.enchantaholic.Enchantaholic;
import dev.enchantaholic.ItemEnchanter;
import dev.enchantaholic.mode.EnchantaholicMode;
import it.unimi.dsi.fastutil.objects.Object2IntMap;
import net.minecraft.core.Holder;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.item.enchantment.ItemEnchantments;
import net.minecraft.world.level.Level;

/** Ids of the 11 data-driven custom enchantments, the per-world switch and level lookups. */
public final class CustomEnchants {
	public static final ResourceKey<Enchantment> VEIN_MINER = key("vein_miner");
	public static final ResourceKey<Enchantment> BARRAGE = key("barrage");
	public static final ResourceKey<Enchantment> YEET = key("yeet");
	public static final ResourceKey<Enchantment> KABOOM = key("kaboom");
	public static final ResourceKey<Enchantment> PARTY_POPPER = key("party_popper");
	public static final ResourceKey<Enchantment> CHICKEN_RAIN = key("chicken_rain");
	public static final ResourceKey<Enchantment> MIDAS_TOUCH = key("midas_touch");
	public static final ResourceKey<Enchantment> MAGNET = key("magnet");
	public static final ResourceKey<Enchantment> MOON_BOOTS = key("moon_boots");
	public static final ResourceKey<Enchantment> BUTTERFINGERS = key("butterfingers");
	public static final ResourceKey<Enchantment> HICCUPS = key("hiccups");

	private static final EquipmentSlot[] ARMOR = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET};

	private CustomEnchants() {}

	private static ResourceKey<Enchantment> key(String path) {
		return ResourceKey.create(Registries.ENCHANTMENT, Identifier.fromNamespaceAndPath(Enchantaholic.MOD_ID, path));
	}

	/** Every enchantment of the enchantaholic namespace is a custom one (datapack additions under it included). */
	public static boolean isCustom(Holder<Enchantment> enchantment) {
		return enchantment.unwrapKey().map(k -> k.identifier().getNamespace().equals(Enchantaholic.MOD_ID)).orElse(false);
	}

	/** Per-world switch (EnchantaholicMode.customEnchants). */
	public static boolean enabled(MinecraftServer server) {
		return server != null && EnchantaholicMode.isCustomEnchants(server);
	}

	/** Switch for the world this level belongs to; false on the client. */
	public static boolean enabled(Level level) {
		return level instanceof ServerLevel server && enabled(server.getServer());
	}

	/** Level of {@code id} on the stack (ENCHANTMENTS, or STORED_ENCHANTMENTS for enchanted books); 0 if absent. */
	public static int level(ItemStack stack, ResourceKey<Enchantment> id) {
		if (stack.isEmpty()) return 0;
		ItemEnchantments enchantments = stack.getOrDefault(ItemEnchanter.componentFor(stack), ItemEnchantments.EMPTY);
		if (enchantments.isEmpty()) return 0;
		for (Object2IntMap.Entry<Holder<Enchantment>> e : enchantments.entrySet()) {
			if (e.getKey().is(id)) return e.getIntValue();
		}
		return 0;
	}

	/** Main hand only. */
	public static int mainHand(LivingEntity entity, ResourceKey<Enchantment> id) {
		return level(entity.getMainHandItem(), id);
	}

	/** Highest of main hand and off hand. */
	public static int hands(LivingEntity entity, ResourceKey<Enchantment> id) {
		return Math.max(level(entity.getMainHandItem(), id), level(entity.getOffhandItem(), id));
	}

	/** Highest over the four armor slots. */
	public static int armor(LivingEntity entity, ResourceKey<Enchantment> id) {
		int max = 0;
		for (EquipmentSlot slot : ARMOR) max = Math.max(max, level(entity.getItemBySlot(slot), id));
		return max;
	}

	/** Highest over inventory slots 0..40 (main, armor, offhand). */
	public static int inventory(Player player, ResourceKey<Enchantment> id) {
		Inventory inv = player.getInventory();
		int max = 0;
		for (int i = ItemEnchanter.FIRST_SLOT; i <= ItemEnchanter.LAST_SLOT; i++) max = Math.max(max, level(inv.getItem(i), id));
		return max;
	}
}
