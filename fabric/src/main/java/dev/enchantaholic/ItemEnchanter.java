package dev.enchantaholic;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import dev.enchantaholic.core.CustomPool;
import dev.enchantaholic.core.EnchantSelector;
import dev.enchantaholic.custom.CustomEnchants;
import dev.enchantaholic.core.Levels;
import net.minecraft.core.Holder;
import net.minecraft.core.RegistryAccess;
import net.minecraft.core.component.DataComponentType;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.Registries;
import net.minecraft.tags.ItemTags;
import net.minecraft.util.RandomSource;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.item.enchantment.Enchantments;
import net.minecraft.world.item.enchantment.ItemEnchantments;
import net.minecraft.world.level.Level;

/** Adapts the player inventory and the enchantment registry to {@link EnchantSelector} and applies the result. */
public final class ItemEnchanter {
	public static final int FIRST_SLOT = 0;
	/** Inclusive: main 0..35, armor 36..39, offhand 40. Body (41) and saddle (42) are never candidates. */
	public static final int LAST_SLOT = Inventory.SLOT_OFFHAND;

	public record Result(int slot, ItemStack stack, Holder<Enchantment> enchantment, int newLevel) {}

	private record InvSlot(int index, ItemStack stack) implements EnchantSelector.SlotView<Holder<Enchantment>> {
		@Override
		public boolean isSpear() {
			return stack.is(ItemTags.SPEARS);
		}

		@Override
		public int level(Holder<Enchantment> enchantment) {
			return getLevel(stack, enchantment);
		}
	}

	private ItemEnchanter() {}

	/**
	 * Selects over non-empty slots 0..40 and the ENCHANTMENT registry, applies, broadcasts. The
	 * enchantaholic:* (custom) enchantments are part of the pool only while this world's Custom Enchantments switch is on.
	 */
	public static Optional<Result> enchantRandom(Player player, RandomSource random) {
		return enchantRandom(player, rollPool(player.level()), random);
	}

	/** The registry, minus the custom enchantments unless they are enabled for this level's world. */
	public static List<Holder<Enchantment>> rollPool(Level level) {
		return CustomPool.filter(allEnchantments(level.registryAccess()), CustomEnchants::isCustom, CustomEnchants.enabled(level));
	}

	/** Same, with an explicit enchantment pool. */
	public static Optional<Result> enchantRandom(Player player, List<Holder<Enchantment>> enchantments, RandomSource random) {
		Inventory inventory = player.getInventory();
		List<InvSlot> slots = new ArrayList<>();
		for (int i = FIRST_SLOT; i <= LAST_SLOT; i++) {
			ItemStack stack = inventory.getItem(i); // live stack, mutated in place below
			if (!stack.isEmpty()) slots.add(new InvSlot(i, stack));
		}
		var pick = EnchantSelector.choose(slots, enchantments, ItemEnchanter::isLunge, random::nextInt);
		if (pick.isEmpty()) return Optional.empty();

		InvSlot slot = pick.get().slot();
		Holder<Enchantment> enchantment = pick.get().enchantment();
		int newLevel = apply(slot.stack(), enchantment);
		player.containerMenu.broadcastChanges();
		return Optional.of(new Result(slot.index(), slot.stack(), enchantment, newLevel));
	}

	/** All enchantments in the registry (curses and datapack ones included), registry order. */
	public static List<Holder<Enchantment>> allEnchantments(RegistryAccess access) {
		return access.lookupOrThrow(Registries.ENCHANTMENT).listElements()
				.map(h -> (Holder<Enchantment>) h)
				.toList();
	}

	/** ENCHANTED_BOOK uses STORED_ENCHANTMENTS, everything else (including a plain book) ENCHANTMENTS. */
	public static DataComponentType<ItemEnchantments> componentFor(ItemStack stack) {
		return stack.is(Items.ENCHANTED_BOOK) ? DataComponents.STORED_ENCHANTMENTS : DataComponents.ENCHANTMENTS;
	}

	public static int getLevel(ItemStack stack, Holder<Enchantment> enchantment) {
		return stack.getOrDefault(componentFor(stack), ItemEnchantments.EMPTY).getLevel(enchantment);
	}

	/** Raises the level by one (new enchantments start at 1, capped at 255) and returns the new level. */
	public static int apply(ItemStack stack, Holder<Enchantment> enchantment) {
		DataComponentType<ItemEnchantments> type = componentFor(stack);
		ItemEnchantments.Mutable mutable = new ItemEnchantments.Mutable(stack.getOrDefault(type, ItemEnchantments.EMPTY));
		int newLevel = Levels.next(mutable.getLevel(enchantment));
		mutable.set(enchantment, newLevel);
		stack.set(type, mutable.toImmutable());
		return newLevel;
	}

	public static boolean isLunge(Holder<Enchantment> enchantment) {
		return enchantment.is(Enchantments.LUNGE);
	}
}
