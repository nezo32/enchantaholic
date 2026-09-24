package dev.enchantaholic.test;

import static dev.enchantaholic.test.CustomTestSupport.allPulsesTick;
import static dev.enchantaholic.test.CustomTestSupport.cleanup;
import static dev.enchantaholic.test.CustomTestSupport.clear;
import static dev.enchantaholic.test.CustomTestSupport.count;
import static dev.enchantaholic.test.CustomTestSupport.customsOn;
import static dev.enchantaholic.test.CustomTestSupport.discardAll;
import static dev.enchantaholic.test.CustomTestSupport.ench;
import static dev.enchantaholic.test.CustomTestSupport.entities;
import static dev.enchantaholic.test.CustomTestSupport.fill;
import static dev.enchantaholic.test.CustomTestSupport.mob;
import static dev.enchantaholic.test.CustomTestSupport.player;
import static dev.enchantaholic.test.CustomTestSupport.sky;
import static dev.enchantaholic.test.CustomTestSupport.withCustomsOff;
import static dev.enchantaholic.test.CustomTestSupport.withModeOff;
import static dev.enchantaholic.test.TestSupport.totalLevels;

import dev.enchantaholic.Enchantaholic;
import dev.enchantaholic.ItemEnchanter;
import dev.enchantaholic.core.CustomMath;
import dev.enchantaholic.custom.CustomEffects;
import dev.enchantaholic.custom.CustomEnchants;
import dev.enchantaholic.custom.Hiccups;
import dev.enchantaholic.custom.Kaboom;
import dev.enchantaholic.custom.PartyPopper;
import dev.enchantaholic.custom.VeinMiner;
import dev.enchantaholic.mode.EnchantaholicMode;
import java.util.ArrayList;
import java.util.List;
import net.fabricmc.fabric.api.gametest.v1.GameTest;
import net.minecraft.core.BlockPos;
import net.minecraft.core.component.DataComponents;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityTypes;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.ExperienceOrb;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.animal.chicken.Chicken;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.entity.monster.zombie.Zombie;
import net.minecraft.world.entity.npc.villager.Villager;
import net.minecraft.world.entity.projectile.FireworkRocketEntity;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.entity.projectile.arrow.AbstractArrow;
import net.minecraft.world.entity.projectile.arrow.ThrownTrident;
import net.minecraft.world.entity.projectile.hurtingprojectile.windcharge.WindCharge;
import net.minecraft.world.entity.projectile.throwableitemprojectile.Snowball;
import net.minecraft.world.entity.projectile.throwableitemprojectile.ThrownEgg;
import net.minecraft.world.entity.projectile.throwableitemprojectile.ThrownEnderpearl;
import net.minecraft.world.entity.projectile.throwableitemprojectile.ThrownExperienceBottle;
import net.minecraft.world.entity.projectile.throwableitemprojectile.ThrownLingeringPotion;
import net.minecraft.world.entity.projectile.throwableitemprojectile.ThrownSplashPotion;
import net.minecraft.world.item.CrossbowItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.ChargedProjectiles;
import net.minecraft.world.item.enchantment.Enchantments;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

/**
 * Server gametests of the custom enchantment effects (one or more per effect), plus performance logs
 * (lines starting with {@code PERF}).
 *
 * <p>Concurrency (spec §6.1): the Custom Enchantments switch is server-global. Every test turns it ON first and never
 * leaves it OFF; OFF checks run synchronously inside {@link CustomTestSupport#withCustomsOff}. Tests that break blocks
 * run with Enchantaholic Mode OFF (restored afterwards) so that no random roll lands on their tools, except the vein
 * miner cap test, which checks the roll count. World-space work happens high above the structure (different heights
 * per test) and every test cleans up its blocks, entities and players.
 */
public class EnchantaholicCustomGameTests {
	/** Server tick in which {@link #kaboomBudget} ran without the Kaboom time budget (excluded from the volley's timing). */
	private static volatile int liftedBudgetTick = -1;
	/** Vein test column (1,152 blocks) inside the 8×8 footprint of the test structure, whose chunks are loaded and ticking. */
	private static final int VEIN_X = 8;
	private static final int VEIN_Y = 18;
	private static final int VEIN_Z = 8;

	// ---------------------------------------------------------------- vein miner

	/** L200 on a 1,152-block column: origin + 1,024 (cap), 64 per tick, 1,025 durability, exactly 1 Enchantaholic roll. */
	@GameTest(maxTicks = 100)
	public void veinMinerCapAndDurability(GameTestHelper h) {
		customsOn(h);
		ServerLevel level = h.getLevel();
		BlockPos base = sky(h, 110);
		BlockPos far = base.offset(VEIN_X - 1, VEIN_Y - 1, VEIN_Z - 1);
		fill(level, base, far, Blocks.STONE.defaultBlockState());
		int total = VEIN_X * VEIN_Y * VEIN_Z;
		h.assertValueEqual(count(level, base, far, Blocks.STONE), total, "stone placed");

		ServerPlayer p = player(h, Vec3.atCenterOf(base).add(0, 20, 0), 0, 0);
		ItemStack pick = ench(h, Items.DIAMOND_PICKAXE, CustomEnchants.VEIN_MINER, 200);
		p.getInventory().setItem(0, pick);
		p.getInventory().setSelectedSlot(0);
		// fillers: the origin's roll almost surely lands on one of these, not on the pickaxe
		for (int i = 1; i <= 35; i++) p.getInventory().setItem(i, new ItemStack(Items.STICK));
		int levelsBefore = inventoryLevels(p);

		EnchantaholicMode.set(h.getLevel().getServer(), true); // the origin rolls, the vein must not
		long t0 = System.nanoTime();
		p.gameMode.destroyBlock(base);
		double firstBatchMs = (System.nanoTime() - t0) / 1.0E6;
		int rolled = inventoryLevels(p) - levelsBefore;
		int brokenNow = total - count(level, base, far, Blocks.STONE);
		Enchantaholic.LOGGER.info("veinMiner cube at {} (structure origin {})", base, h.absolutePos(BlockPos.ZERO));
		Enchantaholic.LOGGER.info("PERF veinMiner first batch (origin + {} blocks) {} ms, pending jobs {}",
				brokenNow - 1, String.format("%.1f", firstBatchMs), VeinMiner.pendingJobs());
		h.assertValueEqual(rolled, 1, "Enchantaholic rolls for the whole vein (origin only)");
		h.assertValueEqual(brokenNow, 1 + VeinMiner.BLOCKS_PER_TICK, "blocks broken inside the break event");

		long start = h.getTick();
		int[] last = {brokenNow};
		int[] maxPerTick = {0};
		long[] tickNs = {System.nanoTime()};
		h.onEachTick(() -> {
			int broken = total - count(level, base, far, Blocks.STONE);
			int delta = broken - last[0];
			last[0] = broken;
			maxPerTick[0] = Math.max(maxPerTick[0], delta);
			h.assertTrue(delta <= VeinMiner.BLOCKS_PER_TICK, "at most 64 blocks per tick, got " + delta);
		});
		h.succeedWhen(() -> {
			int broken = total - count(level, base, far, Blocks.STONE);
			long ticks = h.getTick() - start;
			h.assertTrue(ticks <= 17 || broken == 1 + CustomMath.VEIN_MINER_CAP, "vein not done after 17 ticks: " + broken);
			h.assertValueEqual(broken, 1 + CustomMath.VEIN_MINER_CAP, "blocks broken (origin + cap)");
			double totalMs = (System.nanoTime() - tickNs[0]) / 1.0E6;
			Enchantaholic.LOGGER.info("PERF veinMiner 1,025 blocks done in {} ticks ({} ms wall incl. other tests), max {} blocks/tick",
					ticks, String.format("%.0f", totalMs), maxPerTick[0]);
			if (ItemEnchanter.getLevel(pick, TestSupport.ench(h, Enchantments.UNBREAKING)) == 0) {
				h.assertValueEqual(pick.getDamageValue(), 1 + CustomMath.VEIN_MINER_CAP, "pickaxe durability used");
			}
			h.assertTrue(p.getMainHandItem() == pick, "pickaxe still in hand");
			h.assertValueEqual(inventoryLevels(p) - levelsBefore, 1, "no roll from vein blocks");
			clear(level, base, far);
			discardAll(h, ItemEntity.class, new AABB(base).inflate(24));
			discardAll(h, Chicken.class, new AABB(base).inflate(24));
			cleanup(p);
		});
	}

	/** L1: 8 extra logs of a 20-log column, nearest first; the stone and planks next to them are untouched. */
	@GameTest
	public void veinMinerLevel1(GameTestHelper h) {
		customsOn(h);
		ServerLevel level = h.getLevel();
		BlockPos base = sky(h, 120).offset(1, 0, 1);
		BlockPos top = base.above(19);
		fill(level, base, top, Blocks.OAK_LOG.defaultBlockState());
		fill(level, base.east(), top.east(), Blocks.STONE.defaultBlockState());
		fill(level, base.south(), top.south(), Blocks.OAK_PLANKS.defaultBlockState());
		ServerPlayer p = player(h, Vec3.atCenterOf(base).add(3, 0, 3), 0, 0);
		p.setItemInHand(InteractionHand.MAIN_HAND, ench(h, Items.IRON_AXE, CustomEnchants.VEIN_MINER, 1));
		withModeOff(h, () -> p.gameMode.destroyBlock(base));
		h.assertValueEqual(count(level, base, top, Blocks.OAK_LOG), 11, "logs left (20 - origin - 8)");
		for (int y = 0; y <= 8; y++) h.assertTrue(level.getBlockState(base.above(y)).isAir(), "log " + y + " broken (nearest first)");
		h.assertValueEqual(count(level, base.east(), top.east(), Blocks.STONE), 20, "stone untouched");
		h.assertValueEqual(count(level, base.south(), top.south(), Blocks.OAK_PLANKS), 20, "planks untouched");
		clear(level, base, top.east().south());
		discardAll(h, ItemEntity.class, new AABB(base).inflate(24));
		cleanup(p);
		h.succeed();
	}

	/** A pickaxe with 5 durability left and L10 stops when it breaks, without exceptions or a pending job. */
	@GameTest
	public void veinMinerStopsWhenToolBreaks(GameTestHelper h) {
		customsOn(h);
		ServerLevel level = h.getLevel();
		BlockPos base = sky(h, 120);
		BlockPos far = base.offset(4, 4, 4);
		fill(level, base, far, Blocks.STONE.defaultBlockState());
		ServerPlayer p = player(h, Vec3.atCenterOf(base).add(0, 8, 0), 0, 0);
		ItemStack pick = ench(h, Items.IRON_PICKAXE, CustomEnchants.VEIN_MINER, 10);
		pick.setDamageValue(pick.getMaxDamage() - 5);
		p.setItemInHand(InteractionHand.MAIN_HAND, pick);
		int jobsBefore = VeinMiner.pendingJobs();
		withModeOff(h, () -> p.gameMode.destroyBlock(base));
		int broken = 125 - count(level, base, far, Blocks.STONE);
		h.assertTrue(p.getMainHandItem().isEmpty(), "pickaxe broke");
		h.assertTrue(broken >= 5 && broken <= 6, "vein stopped when the tool broke: " + broken + " broken");
		h.assertValueEqual(VeinMiner.pendingJobs(), jobsBefore, "no pending job left behind");
		clear(level, base, far);
		discardAll(h, ItemEntity.class, new AABB(base).inflate(24));
		cleanup(p);
		h.succeed();
	}

	// ---------------------------------------------------------------- barrage

	/** L60 bow: 1 + 512 (cap) arrows, only the original can be picked up, bow durability 1, all Kaboom-tagged. */
	@GameTest
	public void barrageBow512(GameTestHelper h) {
		customsOn(h);
		ServerPlayer p = player(h, Vec3.atCenterOf(sky(h, 140)), 0, -90);
		ItemStack bow = ench(h, Items.BOW, CustomEnchants.BARRAGE, 60);
		ench(h, bow, CustomEnchants.KABOOM, 2);
		p.setItemInHand(InteractionHand.MAIN_HAND, bow);
		p.getInventory().add(new ItemStack(Items.ARROW, 1));
		long t0 = System.nanoTime();
		Items.BOW.releaseUsing(bow, h.getLevel(), p, 72000 - 30);
		double ms = (System.nanoTime() - t0) / 1.0E6;
		AABB box = p.getBoundingBox().inflate(8);
		List<AbstractArrow> arrows = owned(h, AbstractArrow.class, box, p);
		long allowed = arrows.stream().filter(a -> a.pickup == AbstractArrow.Pickup.ALLOWED).count();
		long tagged = arrows.stream().filter(a -> a.entityTags().contains(Kaboom.TAG_PREFIX + 2)).count();
		Enchantaholic.LOGGER.info("PERF barrage bow L60: {} arrows in {} ms", arrows.size(), String.format("%.1f", ms));
		arrows.forEach(Entity::discard);
		h.assertValueEqual(arrows.size(), 1 + CustomMath.BARRAGE_CAP, "arrows (1 + cap)");
		h.assertValueEqual(allowed, 1L, "arrows that can be picked up");
		h.assertValueEqual(tagged, (long) arrows.size(), "Kaboom-tagged arrows");
		h.assertValueEqual(bow.getDamageValue(), 1, "bow durability used");
		h.assertValueEqual(p.getInventory().countItem(Items.ARROW), 0, "arrows left in the inventory");

		// second shot: warm timing
		p.getInventory().add(new ItemStack(Items.ARROW, 1));
		t0 = System.nanoTime();
		Items.BOW.releaseUsing(bow, h.getLevel(), p, 72000 - 30);
		double warmMs = (System.nanoTime() - t0) / 1.0E6;
		List<AbstractArrow> again = owned(h, AbstractArrow.class, box, p);
		again.forEach(Entity::discard);
		Enchantaholic.LOGGER.info("PERF barrage bow L60 (warm): {} arrows in {} ms", again.size(), String.format("%.1f", warmMs));
		h.assertValueEqual(again.size(), 1 + CustomMath.BARRAGE_CAP, "arrows on the second shot");
		cleanup(p);
		h.succeed();
	}

	/** Crossbow with a charged arrow → 1 + 10L arrows; with a charged firework rocket → 1 + 10L rockets. */
	@GameTest
	public void barrageCrossbow(GameTestHelper h) {
		customsOn(h);
		ServerPlayer p = player(h, Vec3.atCenterOf(sky(h, 140)), 0, -90);
		AABB box = p.getBoundingBox().inflate(8);
		CrossbowItem crossbowItem = (CrossbowItem) Items.CROSSBOW;

		ItemStack crossbow = ench(h, Items.CROSSBOW, CustomEnchants.BARRAGE, 2);
		crossbow.set(DataComponents.CHARGED_PROJECTILES, ChargedProjectiles.ofNonEmpty(List.of(new ItemStack(Items.ARROW))));
		p.setItemInHand(InteractionHand.MAIN_HAND, crossbow);
		crossbowItem.performShooting(h.getLevel(), p, InteractionHand.MAIN_HAND, crossbow, 3.15F, 1.0F, null);
		List<AbstractArrow> arrows = owned(h, AbstractArrow.class, box, p);
		long allowed = arrows.stream().filter(a -> a.pickup == AbstractArrow.Pickup.ALLOWED).count();
		arrows.forEach(Entity::discard);
		h.assertValueEqual(arrows.size(), 21, "crossbow arrows (1 + 10×2)");
		h.assertValueEqual(allowed, 1L, "crossbow arrows that can be picked up");

		ItemStack rocketBow = ench(h, Items.CROSSBOW, CustomEnchants.BARRAGE, 1);
		rocketBow.set(DataComponents.CHARGED_PROJECTILES, ChargedProjectiles.ofNonEmpty(List.of(new ItemStack(Items.FIREWORK_ROCKET))));
		p.setItemInHand(InteractionHand.MAIN_HAND, rocketBow);
		crossbowItem.performShooting(h.getLevel(), p, InteractionHand.MAIN_HAND, rocketBow, 1.6F, 1.0F, null);
		List<FireworkRocketEntity> rockets = owned(h, FireworkRocketEntity.class, box, p);
		rockets.forEach(Entity::discard);
		h.assertValueEqual(rockets.size(), 11, "crossbow firework rockets (1 + 10)");
		cleanup(p);
		h.succeed();
	}

	/** Throwables: copies for snowball/egg/wind charge/potions; never for ender pearls or bottles o' enchanting. */
	@GameTest
	public void barrageThrowables(GameTestHelper h) {
		customsOn(h);
		ServerPlayer p = player(h, Vec3.atCenterOf(sky(h, 140)), 0, -90);
		AABB box = p.getBoundingBox().inflate(8);

		ItemStack snow = ench(h, new ItemStack(Items.SNOWBALL, 16), CustomEnchants.BARRAGE, 3);
		int snowballs = throwAndCount(h, p, snow, Snowball.class, box);
		h.assertValueEqual(snowballs, 31, "snowballs (1 + 30)");
		h.assertValueEqual(snow.getCount(), 15, "snowball stack lost only 1");

		h.assertValueEqual(throwAndCount(h, p, ench(h, new ItemStack(Items.EGG, 4), CustomEnchants.BARRAGE, 1), ThrownEgg.class, box), 11, "eggs");
		h.assertValueEqual(throwAndCount(h, p, ench(h, new ItemStack(Items.WIND_CHARGE, 4), CustomEnchants.BARRAGE, 1), WindCharge.class, box), 11,
				"wind charges");
		h.assertValueEqual(throwAndCount(h, p, ench(h, Items.SPLASH_POTION, CustomEnchants.BARRAGE, 1), ThrownSplashPotion.class, box), 11,
				"splash potions");
		h.assertValueEqual(throwAndCount(h, p, ench(h, Items.LINGERING_POTION, CustomEnchants.BARRAGE, 1), ThrownLingeringPotion.class, box), 11,
				"lingering potions");
		h.assertValueEqual(throwAndCount(h, p, ench(h, new ItemStack(Items.ENDER_PEARL, 4), CustomEnchants.BARRAGE, 5), ThrownEnderpearl.class, box),
				1, "ender pearls (never copied)");
		h.assertValueEqual(throwAndCount(h, p, ench(h, new ItemStack(Items.EXPERIENCE_BOTTLE, 4), CustomEnchants.BARRAGE, 5),
				ThrownExperienceBottle.class, box), 1, "bottles o' enchanting (never copied)");
		cleanup(p);
		h.succeed();
	}

	/** Trident L1 + Loyalty III: 11 tridents, 1 can be picked up, 1 loyal; touching every landed one yields at most 1 trident. */
	@GameTest(maxTicks = 120)
	public void barrageTridentNoDupe(GameTestHelper h) {
		customsOn(h);
		ServerLevel level = h.getLevel();
		BlockPos floor = sky(h, 150);
		BlockPos from = floor.offset(-12, 0, -12);
		BlockPos to = floor.offset(12, 0, 12);
		fill(level, from, to, Blocks.GLASS.defaultBlockState());
		// from above one corner of the footprint, steeply down toward the middle: the tridents land in ticking chunks
		ServerPlayer p = player(h, Vec3.atBottomCenterOf(floor.offset(1, 3, 1)), -45, 60);
		ItemStack trident = ench(h, Items.TRIDENT, CustomEnchants.BARRAGE, 1);
		ench(h, trident, Enchantments.LOYALTY, 3);
		p.setItemInHand(InteractionHand.MAIN_HAND, trident);
		Items.TRIDENT.releaseUsing(trident, level, p, 72000 - 30);
		AABB box = new AABB(floor).inflate(20);
		List<ThrownTrident> tridents = owned(h, ThrownTrident.class, box, p);
		long allowed = tridents.stream().filter(t -> t.pickup == AbstractArrow.Pickup.ALLOWED).count();
		long loyal = tridents.stream().filter(t -> loyalty(h, t.getPickupItemStackOrigin()) > 0).count();
		h.assertValueEqual(tridents.size(), 11, "tridents (1 + 10)");
		h.assertValueEqual(allowed, 1L, "tridents that can be picked up");
		h.assertValueEqual(loyal, 1L, "loyal tridents");
		h.assertValueEqual(p.getInventory().countItem(Items.TRIDENT), 0, "thrown trident left the inventory");

		h.runAfterDelay(40, () -> {
			// what the player's touch would do for every trident, landed or returning
			for (ThrownTrident t : owned(h, ThrownTrident.class, box, p)) t.playerTouch(p);
			int inInventory = p.getInventory().countItem(Items.TRIDENT);
			h.assertTrue(inInventory <= 1, "at most the original trident comes back, got " + inInventory);
			owned(h, ThrownTrident.class, box, p).forEach(Entity::discard);
			clear(level, from, to);
			cleanup(p);
			h.succeed();
		});
	}

	// ---------------------------------------------------------------- kaboom

	/** Bow with KABOOM 3 shot down at a glass platform: explodes once, hurts the villager next to it, breaks no block. */
	@GameTest(maxTicks = 100)
	public void kaboomNoBlockDamage(GameTestHelper h) {
		customsOn(h);
		ServerLevel level = h.getLevel();
		BlockPos floor = sky(h, 160).offset(4, 0, 4);
		BlockPos from = floor.offset(-3, 0, -3);
		BlockPos to = floor.offset(3, 0, 3);
		fill(level, from, to, Blocks.GLASS.defaultBlockState());
		Villager villager = mob(h, EntityTypes.VILLAGER, Vec3.atBottomCenterOf(floor.offset(-2, 1, -2)));
		float health = villager.getHealth();
		ServerPlayer p = player(h, Vec3.atBottomCenterOf(floor.above(6)), 0, 90);
		ItemStack bow = ench(h, Items.BOW, CustomEnchants.KABOOM, 3);
		p.setItemInHand(InteractionHand.MAIN_HAND, bow);
		p.getInventory().add(new ItemStack(Items.ARROW, 1));
		Items.BOW.releaseUsing(bow, level, p, 72000 - 30);
		AABB box = new AABB(floor).inflate(10);
		List<AbstractArrow> arrows = owned(h, AbstractArrow.class, box, p);
		h.assertValueEqual(arrows.size(), 1, "arrows");
		AbstractArrow arrow = arrows.get(0);
		h.assertTrue(arrow.entityTags().contains(Kaboom.TAG_PREFIX + 3), "arrow tagged with the bow's Kaboom level");

		h.succeedWhen(() -> {
			h.assertTrue(arrow.entityTags().stream().noneMatch(t -> t.startsWith(Kaboom.TAG_PREFIX)), "arrow exploded (tag removed)");
			h.assertTrue(villager.getHealth() < health, "villager took explosion damage");
			h.assertValueEqual(count(level, from, to, Blocks.GLASS), 49, "glass blocks intact");
			villager.discard();
			owned(h, AbstractArrow.class, box, p).forEach(Entity::discard);
			discardAll(h, ItemEntity.class, box);
			clear(level, from, to);
			cleanup(p);
		});
	}

	/**
	 * 200 tagged snowballs impacting in one tick: exactly 64 explosions (count cap, time budget lifted), all tags consumed;
	 * the next tick the budget is back, stays within the time budget, and an exhausted time budget makes impacts fizzle.
	 */
	@GameTest
	public void kaboomBudget(GameTestHelper h) {
		customsOn(h);
		ServerLevel level = h.getLevel();
		BlockPos base = sky(h, 180);
		ServerPlayer p = player(h, Vec3.atCenterOf(base), 0, 0);
		List<Snowball> balls = new ArrayList<>();
		for (int i = 0; i < 200; i++) balls.add(taggedSnowball(level, p, base, i));
		long t0 = System.nanoTime();
		Kaboom.setNanosBudget(Long.MAX_VALUE);
		liftedBudgetTick = h.getLevel().getServer().getTickCount();
		try {
			for (Snowball s : balls) Kaboom.onImpact(s);
		} finally {
			Kaboom.setNanosBudget(CustomMath.KABOOM_NANOS_PER_TICK);
		}
		double ms = (System.nanoTime() - t0) / 1.0E6;
		int exploded = Kaboom.explosionsThisTick();
		Enchantaholic.LOGGER.info("PERF kaboom 200 dense impacts, no time budget (cold): {} explosions in {} ms", exploded, String.format("%.1f", ms));
		long stillTagged = balls.stream().filter(EnchantaholicCustomGameTests::kaboomTagged).count();
		balls.forEach(Entity::discard);
		h.assertValueEqual(exploded, CustomMath.KABOOM_PER_TICK, "explosions this tick (count cap)");
		h.assertValueEqual(stillTagged, 0L, "tags consumed (explodes once per projectile)");

		h.runAfterDelay(1, () -> {
			h.assertTrue(Kaboom.explosionsThisTick() < CustomMath.KABOOM_PER_TICK, "count budget reset on the next tick");
			// warm, with the real time budget
			List<Snowball> more = new ArrayList<>();
			for (int i = 0; i < 200; i++) more.add(taggedSnowball(level, p, base, i));
			int before = Kaboom.explosionsThisTick();
			long t1 = System.nanoTime();
			for (Snowball s : more) Kaboom.onImpact(s);
			double warmMs = (System.nanoTime() - t1) / 1.0E6;
			int warm = Kaboom.explosionsThisTick() - before;
			Enchantaholic.LOGGER.info("PERF kaboom 200 dense impacts (warm, 20 ms budget): {} explosions in {} ms, {} ms of explosion work this tick",
					warm, String.format("%.1f", warmMs), String.format("%.1f", Kaboom.nanosThisTick() / 1.0E6));
			h.assertTrue(Kaboom.explosionsThisTick() <= CustomMath.KABOOM_PER_TICK, "count cap");
			h.assertTrue(more.stream().noneMatch(EnchantaholicCustomGameTests::kaboomTagged), "tags consumed");
			more.forEach(Entity::discard);

			// time budget exhausted: the impact fizzles
			Kaboom.setNanosBudget(0);
			try {
				Snowball last = taggedSnowball(level, p, base, 0);
				int n = Kaboom.explosionsThisTick();
				Kaboom.onImpact(last);
				h.assertValueEqual(Kaboom.explosionsThisTick(), n, "no explosion once the time budget is spent");
				h.assertTrue(!kaboomTagged(last), "fizzled projectile lost its tag");
				last.discard();
			} finally {
				Kaboom.setNanosBudget(CustomMath.KABOOM_NANOS_PER_TICK);
			}
			cleanup(p);
			h.succeed();
		});
	}

	/**
	 * Barrage L60 + Kaboom L2 shot straight down at glass: 513 exploding arrows in a dense cluster. No block breaks,
	 * the arrows are not scattered, and every tick stays within the count cap. Logs the tick times.
	 */
	@GameTest(maxTicks = 100)
	public void kaboomBarrageVolley(GameTestHelper h) {
		customsOn(h);
		ServerLevel level = h.getLevel();
		BlockPos floor = sky(h, 150).offset(4, 0, 4); // the arrows land around the middle of the footprint (ticking chunks)
		BlockPos from = floor.offset(-12, 0, -12);
		BlockPos to = floor.offset(12, 0, 12);
		fill(level, from, to, Blocks.GLASS.defaultBlockState());
		ServerPlayer p = player(h, Vec3.atBottomCenterOf(floor.above(12)), 0, 90);
		ItemStack bow = ench(h, Items.BOW, CustomEnchants.BARRAGE, 60);
		ench(h, bow, CustomEnchants.KABOOM, 2);
		p.setItemInHand(InteractionHand.MAIN_HAND, bow);
		p.getInventory().add(new ItemStack(Items.ARROW, 1));
		Items.BOW.releaseUsing(bow, level, p, 72000 - 30);
		AABB box = new AABB(floor).inflate(40);
		h.assertValueEqual(owned(h, AbstractArrow.class, box, p).size(), 1 + CustomMath.BARRAGE_CAP, "arrows");
		long[] maxNanos = {0};
		int[] maxExplosions = {0};
		int[] total = {0};
		h.onEachTick(() -> {
			// skip the tick in which kaboomBudget lifted the time budget for its synchronous part
			if (h.getLevel().getServer().getTickCount() != liftedBudgetTick) maxNanos[0] = Math.max(maxNanos[0], Kaboom.nanosThisTick());
			maxExplosions[0] = Math.max(maxExplosions[0], Kaboom.explosionsThisTick());
			total[0] += Kaboom.explosionsThisTick();
			h.assertTrue(Kaboom.explosionsThisTick() <= CustomMath.KABOOM_PER_TICK, "count cap");
		});
		h.succeedWhen(() -> {
			List<AbstractArrow> arrows = owned(h, AbstractArrow.class, box, p);
			h.assertTrue(arrows.stream().noneMatch(EnchantaholicCustomGameTests::kaboomTagged), "every arrow has landed and exploded (or fizzled)");
			h.assertValueEqual(count(level, from, to, Blocks.GLASS), 25 * 25, "glass intact");
			long scattered = arrows.stream().filter(a -> a.getY() < floor.getY()).count();
			h.assertValueEqual(scattered, 0L, "arrows blown off the platform");
			Enchantaholic.LOGGER.info("PERF kaboom barrage volley (513 arrows): ~{} explosions (all tests), max {} in one tick, max {} ms of explosion work in one tick",
					total[0], maxExplosions[0], String.format("%.1f", maxNanos[0] / 1.0E6));
			arrows.forEach(Entity::discard);
			clear(level, from, to);
			cleanup(p);
		});
	}

	// ---------------------------------------------------------------- yeet

	/** YEET 5 (+ Knockback II, which must not flatten the launch): up 2.0 and away; L1000 is capped at 3.0. */
	@GameTest
	public void yeetLaunches(GameTestHelper h) {
		customsOn(h);
		ServerLevel level = h.getLevel();
		BlockPos floor = sky(h, 100);
		fill(level, floor.offset(-2, 0, -2), floor.offset(4, 0, 2), Blocks.GLASS.defaultBlockState());
		Zombie zombie = mob(h, EntityTypes.ZOMBIE, Vec3.atBottomCenterOf(floor.offset(2, 1, 0)));
		ServerPlayer p = player(h, Vec3.atBottomCenterOf(floor.above()), -90, 0); // yaw -90: looking toward +x
		ItemStack sword = ench(h, Items.DIAMOND_SWORD, CustomEnchants.YEET, 5);
		ench(h, sword, Enchantments.KNOCKBACK, 2);
		p.setItemInHand(InteractionHand.MAIN_HAND, sword);
		zombie.setOnGround(true); // on the ground, vanilla's extra knockback would flatten the launch
		p.attack(zombie);
		Vec3 v = zombie.getDeltaMovement();
		h.assertTrue(v.y >= 1.9, "L5 launch up >= 1.9, got " + v);
		h.assertTrue(v.x > 1.3 && Math.abs(v.z) < 0.1, "L5 launch away from the attacker (+x ≈ 1.4), got " + v);

		Zombie big = mob(h, EntityTypes.ZOMBIE, Vec3.atBottomCenterOf(floor.offset(2, 1, 0)));
		big.setOnGround(true);
		p.setItemInHand(InteractionHand.MAIN_HAND, ench(h, Items.DIAMOND_SWORD, CustomEnchants.YEET, 1000));
		p.attack(big);
		Vec3 w = big.getDeltaMovement();
		h.assertTrue(w.y <= CustomMath.YEET_VERTICAL_CAP + 1.0E-6 && w.y > 2.9, "L1000 capped at 3.0 up, got " + w);
		h.assertTrue(w.horizontalDistance() <= CustomMath.YEET_HORIZONTAL_CAP + 1.0E-6, "L1000 capped at 3.0 away, got " + w);
		zombie.discard();
		big.discard();
		clear(level, floor.offset(-2, 0, -2), floor.offset(4, 0, 2));
		cleanup(p);
		h.succeed();
	}

	// ---------------------------------------------------------------- party popper

	/** Kills with L3 and L20 (cap 16): 19 tagged rockets; their blasts hurt nobody. */
	@GameTest(maxTicks = 120)
	public void partyPopperFireworks(GameTestHelper h) {
		customsOn(h);
		ServerLevel level = h.getLevel();
		BlockPos base = sky(h, 100).offset(4, 0, 4); // rockets must fly in ticking chunks: stay inside the footprint
		ServerPlayer p = player(h, Vec3.atBottomCenterOf(base), 0, 0);
		Villager bystander = mob(h, EntityTypes.VILLAGER, Vec3.atBottomCenterOf(base.offset(1, 0, 1)));
		bystander.setNoGravity(true);
		float bystanderHealth = bystander.getHealth();
		AABB box = new AABB(base).inflate(40);

		p.setItemInHand(InteractionHand.MAIN_HAND, ench(h, Items.DIAMOND_SWORD, CustomEnchants.PARTY_POPPER, 3));
		Zombie a = mob(h, EntityTypes.ZOMBIE, Vec3.atBottomCenterOf(base.offset(2, 0, 0)));
		a.hurtServer(level, p.damageSources().playerAttack(p), 1000.0F);
		h.assertTrue(a.isDeadOrDying(), "first zombie died");
		h.assertValueEqual(rockets(h, box).size(), 3, "rockets after an L3 kill");

		p.setItemInHand(InteractionHand.MAIN_HAND, ench(h, Items.DIAMOND_SWORD, CustomEnchants.PARTY_POPPER, 20));
		Zombie b = mob(h, EntityTypes.ZOMBIE, Vec3.atBottomCenterOf(base.offset(-2, 0, 0)));
		b.hurtServer(level, p.damageSources().playerAttack(p), 1000.0F);
		List<FireworkRocketEntity> rockets = rockets(h, box);
		h.assertValueEqual(rockets.size(), 3 + CustomMath.PARTY_POPPER_CAP, "rockets after an L20 kill (cap 16)");

		// the rockets' blast damage is cancelled
		h.assertTrue(!bystander.hurtServer(level, level.damageSources().fireworks(rockets.get(0), p), 5.0F), "rocket damage cancelled");
		h.assertValueEqual(bystander.getHealth(), bystanderHealth, "bystander health after a direct rocket hit");

		h.succeedWhen(() -> {
			h.assertValueEqual(rockets(h, box).size(), 0, "rockets left (all exploded)");
			h.assertValueEqual(bystander.getHealth(), bystanderHealth, "bystander health after the fireworks");
			bystander.discard();
			AABB near = new AABB(base).inflate(6);
			discardAll(h, Zombie.class, near);
			discardAll(h, ItemEntity.class, near);
			discardAll(h, ExperienceOrb.class, near);
			cleanup(p);
		});
	}

	// ---------------------------------------------------------------- chicken rain / midas touch / butterfingers

	/** L20 (100 %): one chicken per break at the block; no enchantment: no chicken. */
	@GameTest
	public void chickenRainAlways(GameTestHelper h) {
		customsOn(h);
		ServerLevel level = h.getLevel();
		BlockPos pos = sky(h, 100);
		ServerPlayer p = player(h, Vec3.atBottomCenterOf(pos.above(3)), 0, 0);
		AABB box = new AABB(pos).inflate(2);
		withModeOff(h, () -> {
			p.setItemInHand(InteractionHand.MAIN_HAND, ench(h, Items.IRON_PICKAXE, CustomEnchants.CHICKEN_RAIN, 20));
			breakRepeatedly(level, p, pos, Blocks.STONE, 5);
			h.assertValueEqual(entities(h, Chicken.class, box).size(), 5, "chickens after 5 breaks at L20");
			discardAll(h, Chicken.class, box);
			p.setItemInHand(InteractionHand.MAIN_HAND, new ItemStack(Items.IRON_PICKAXE));
			breakRepeatedly(level, p, pos, Blocks.STONE, 5);
			h.assertValueEqual(entities(h, Chicken.class, box).size(), 0, "chickens without Chicken Rain");
		});
		discardAll(h, ItemEntity.class, box.inflate(4));
		cleanup(p);
		h.succeed();
	}

	/** L67: an ingot on every break; L34: a gold drop (nugget or ingot) on every break. */
	@GameTest
	public void midasTouch(GameTestHelper h) {
		customsOn(h);
		ServerLevel level = h.getLevel();
		BlockPos pos = sky(h, 100);
		ServerPlayer p = player(h, Vec3.atBottomCenterOf(pos.above(3)), 0, 0);
		AABB box = new AABB(pos).inflate(3);
		withModeOff(h, () -> {
			p.setItemInHand(InteractionHand.MAIN_HAND, ench(h, Items.IRON_PICKAXE, CustomEnchants.MIDAS_TOUCH, 67));
			breakRepeatedly(level, p, pos, Blocks.STONE, 20);
			h.assertValueEqual(itemCount(h, box, Items.GOLD_INGOT), 20, "ingots after 20 breaks at L67");
			h.assertValueEqual(itemCount(h, box, Items.GOLD_NUGGET), 0, "nuggets at L67");
			discardAll(h, ItemEntity.class, box);

			p.setItemInHand(InteractionHand.MAIN_HAND, ench(h, Items.IRON_PICKAXE, CustomEnchants.MIDAS_TOUCH, 34));
			breakRepeatedly(level, p, pos, Blocks.STONE, 50);
			h.assertValueEqual(itemCount(h, box, Items.GOLD_INGOT) + itemCount(h, box, Items.GOLD_NUGGET), 50, "gold drops after 50 breaks at L34");
			discardAll(h, ItemEntity.class, box);

			p.setItemInHand(InteractionHand.MAIN_HAND, new ItemStack(Items.IRON_PICKAXE));
			breakRepeatedly(level, p, pos, Blocks.STONE, 20);
			h.assertValueEqual(itemCount(h, box, Items.GOLD_INGOT) + itemCount(h, box, Items.GOLD_NUGGET), 0, "gold without Midas Touch");
		});
		discardAll(h, ItemEntity.class, box);
		cleanup(p);
		h.succeed();
	}

	/** L25 (50 %): breaking and hitting eventually drop the held item as a delayed-pickup item entity; L0 never does. */
	@GameTest
	public void butterfingers(GameTestHelper h) {
		customsOn(h);
		ServerLevel level = h.getLevel();
		BlockPos pos = sky(h, 100);
		ServerPlayer p = player(h, Vec3.atBottomCenterOf(pos.above(3)), 0, 0);
		AABB box = new AABB(pos).inflate(6);
		withModeOff(h, () -> {
			p.setItemInHand(InteractionHand.MAIN_HAND, new ItemStack(Items.IRON_PICKAXE));
			breakRepeatedly(level, p, pos, Blocks.STONE, 50);
			h.assertTrue(p.getMainHandItem().is(Items.IRON_PICKAXE), "no curse: the pickaxe stays in hand");

			ItemStack cursed = ench(h, Items.IRON_PICKAXE, CustomEnchants.BUTTERFINGERS, 25);
			p.setItemInHand(InteractionHand.MAIN_HAND, cursed);
			int breaks = 0;
			while (!p.getMainHandItem().isEmpty() && breaks < 100) {
				breakRepeatedly(level, p, pos, Blocks.STONE, 1);
				breaks++;
			}
			h.assertTrue(p.getMainHandItem().isEmpty(), "block breaks: hand emptied within 100 breaks at 50 %");
			assertDropped(h, box, cursed);

			ItemStack sword = ench(h, Items.IRON_SWORD, CustomEnchants.BUTTERFINGERS, 25);
			p.setItemInHand(InteractionHand.MAIN_HAND, sword);
			Zombie zombie = mob(h, EntityTypes.ZOMBIE, Vec3.atBottomCenterOf(pos.above(3)).add(1.5, 0, 0));
			zombie.setNoGravity(true);
			int hits = 0;
			while (!p.getMainHandItem().isEmpty() && hits < 100) {
				zombie.setHealth(zombie.getMaxHealth());
				hits++;
				// rising amounts get through the post-hit invulnerability (1 damage each)
				h.assertTrue(zombie.hurtServer(level, p.damageSources().playerAttack(p), hits), "hit " + hits + " landed");
			}
			h.assertTrue(p.getMainHandItem().isEmpty(), "melee hits: hand emptied within 100 hits at 50 %");
			assertDropped(h, box, sword);
			zombie.discard();
		});
		discardAll(h, ItemEntity.class, box);
		cleanup(p);
		h.succeed();
	}

	// ---------------------------------------------------------------- magnet

	/** Pulls toward the player at 0.2 + 0.05·d; radius 3 + L capped at 24; 256 entities per pulse; E2E it gets closer. */
	@GameTest(maxTicks = 60)
	public void magnetPulls(GameTestHelper h) {
		customsOn(h);
		ServerLevel level = h.getLevel();
		BlockPos base = sky(h, 200);
		BlockPos from = base.offset(-10, 0, -10);
		BlockPos to = base.offset(10, 0, 10);
		fill(level, from, to, Blocks.GLASS.defaultBlockState());
		ServerPlayer p = player(h, Vec3.atBottomCenterOf(base.above()), 0, 0);
		Vec3 center = p.position().add(0, p.getBbHeight() / 2, 0);
		AABB box = new AABB(base).inflate(40);
		int tick = allPulsesTick(p);

		// entity cap: 300 items within the radius, only 256 moved (and timing)
		p.setItemInHand(InteractionHand.OFF_HAND, ench(h, Items.STICK, CustomEnchants.MAGNET, 20));
		List<ItemEntity> many = new ArrayList<>();
		for (int i = 0; i < 300; i++) {
			double angle = i * 0.37;
			double r = 3 + (i % 4);
			many.add(item(level, center.add(Math.cos(angle) * r, 0.5, Math.sin(angle) * r), Items.DIRT));
		}
		long t0 = System.nanoTime();
		CustomEffects.tickPlayer(p, tick);
		double ms = (System.nanoTime() - t0) / 1.0E6;
		long moved = many.stream().filter(e -> e.getDeltaMovement().lengthSqr() > 1.0E-6).count();
		Enchantaholic.LOGGER.info("PERF magnet pulse over 300 items: {} moved in {} ms", moved, String.format("%.2f", ms));
		many.forEach(Entity::discard);
		h.assertValueEqual(moved, (long) CustomMath.MAGNET_ENTITY_CAP, "items moved in one pulse (cap)");

		// radius cap: L100 → 24; 20 blocks away moves, 30 blocks away does not; XP orbs too
		p.setItemInHand(InteractionHand.OFF_HAND, ench(h, Items.STICK, CustomEnchants.MAGNET, 100));
		ItemEntity near = item(level, center.add(20, 0, 0), Items.DIRT);
		ItemEntity farItem = item(level, center.add(0, 0, 30), Items.DIRT);
		ExperienceOrb orb = new ExperienceOrb(level, center.x - 10, center.y, center.z, 3);
		orb.setDeltaMovement(Vec3.ZERO);
		level.addFreshEntity(orb);
		CustomEffects.tickPlayer(p, tick);
		h.assertTrue(near.getDeltaMovement().x < -0.5, "item 20 blocks away pulled at L100, got " + near.getDeltaMovement());
		h.assertTrue(farItem.getDeltaMovement().lengthSqr() < 1.0E-9, "item 30 blocks away untouched (radius cap 24)");
		h.assertTrue(orb.getDeltaMovement().x > 0.5, "XP orb pulled, got " + orb.getDeltaMovement());
		near.discard();
		farItem.discard();
		orb.discard();

		// L5 in the off hand, radius 8: exact velocity, then the real server tick pulls it closer
		p.setItemInHand(InteractionHand.OFF_HAND, ench(h, Items.STICK, CustomEnchants.MAGNET, 5));
		ItemEntity drop = item(level, Vec3.atBottomCenterOf(base.above()).add(6, 0, 0), Items.DIAMOND);
		double d0 = drop.position().distanceTo(center);
		CustomEffects.tickPlayer(p, tick);
		Vec3 v = drop.getDeltaMovement();
		h.assertTrue(Math.abs(v.length() - Math.min(0.8, 0.2 + 0.05 * d0)) < 1.0E-6, "pull speed 0.2 + 0.05·d, got " + v.length());
		h.assertTrue(v.x < 0, "pulled toward the player, got " + v);
		h.runAfterDelay(20, () -> {
			double d = drop.isRemoved() ? 0 : drop.position().distanceTo(center);
			h.assertTrue(d < d0 - 1.0, "item came closer: " + d0 + " -> " + d);
			drop.discard();
			discardAll(h, ItemEntity.class, box);
			clear(level, from, to);
			cleanup(p);
			h.succeed();
		});
	}

	// ---------------------------------------------------------------- moon boots

	/** Jump Boost L−1 (cap 10) from any armor slot, refreshed by the server tick; fall damage cancelled for any wearer. */
	@GameTest(maxTicks = 40)
	public void moonBoots(GameTestHelper h) {
		customsOn(h);
		ServerLevel level = h.getLevel();
		ServerPlayer p = player(h, Vec3.atCenterOf(sky(h, 100)), 0, 0);
		int tick = allPulsesTick(p);

		p.setItemSlot(EquipmentSlot.FEET, ench(h, Items.IRON_BOOTS, CustomEnchants.MOON_BOOTS, 3));
		CustomEffects.tickPlayer(p, tick);
		h.assertValueEqual(jumpBoost(p), 2, "Jump Boost amplifier at L3");
		p.setItemSlot(EquipmentSlot.FEET, ench(h, Items.IRON_BOOTS, CustomEnchants.MOON_BOOTS, 50));
		CustomEffects.tickPlayer(p, tick);
		h.assertValueEqual(jumpBoost(p), CustomMath.MOON_BOOTS_AMPLIFIER_CAP, "Jump Boost amplifier at L50 (cap)");
		p.setItemSlot(EquipmentSlot.FEET, ItemStack.EMPTY);
		p.setItemSlot(EquipmentSlot.CHEST, ench(h, Items.IRON_CHESTPLATE, CustomEnchants.MOON_BOOTS, 1));
		p.removeAllEffects();
		CustomEffects.tickPlayer(p, tick);
		h.assertValueEqual(jumpBoost(p), 0, "Jump Boost amplifier at L1 on a chestplate");

		// fall damage (a zombie: mock players are invulnerable until their client "loads")
		Zombie zombie = mob(h, EntityTypes.ZOMBIE, Vec3.atCenterOf(sky(h, 104)));
		zombie.setNoGravity(true);
		zombie.setItemSlot(EquipmentSlot.FEET, ench(h, Items.LEATHER_BOOTS, CustomEnchants.MOON_BOOTS, 1));
		float health = zombie.getHealth();
		h.assertTrue(!zombie.hurtServer(level, zombie.damageSources().fall(), 10.0F), "fall damage with Moon Boots cancelled");
		h.assertValueEqual(zombie.getHealth(), health, "health with Moon Boots");
		zombie.setItemSlot(EquipmentSlot.FEET, ItemStack.EMPTY);
		h.assertTrue(zombie.hurtServer(level, zombie.damageSources().fall(), 10.0F), "fall damage without Moon Boots");
		h.assertTrue(zombie.getHealth() < health, "health drops without Moon Boots");
		zombie.discard();

		// end to end: the server tick refreshes the effect
		p.removeAllEffects();
		h.runAfterDelay(12, () -> {
			h.assertValueEqual(jumpBoost(p), 0, "Jump Boost re-applied by the server tick");
			cleanup(p);
			h.succeed();
		});
	}

	// ---------------------------------------------------------------- hiccups

	/** A hiccup is an upward hop; L20 (60 %) over 100 rolls hops 40..80 times; without the curse never. */
	@GameTest
	public void hiccups(GameTestHelper h) {
		customsOn(h);
		ServerPlayer p = player(h, Vec3.atCenterOf(sky(h, 100)), 0, 0);
		Hiccups.hiccup(p);
		h.assertTrue(p.getDeltaMovement().y >= Hiccups.HOP_VELOCITY - 1.0E-6, "hiccup hop, got " + p.getDeltaMovement());

		int tick = allPulsesTick(p);
		p.getInventory().setItem(20, ench(h, Items.STICK, CustomEnchants.HICCUPS, 20)); // anywhere in the inventory
		int hops = countHops(p, tick, 100);
		h.assertTrue(hops >= 40 && hops <= 80, "hops at 60 % over 100 rolls: " + hops);

		p.getInventory().setItem(20, ItemStack.EMPTY);
		h.assertValueEqual(countHops(p, tick, 50), 0, "hops without the curse");
		cleanup(p);
		h.succeed();
	}

	// ---------------------------------------------------------------- the switch

	/** With the switch OFF, no effect does anything (items keep their enchantments). Synchronous; restores ON. */
	@GameTest
	public void effectsOffWhenSwitchOff(GameTestHelper h) {
		customsOn(h);
		ServerLevel level = h.getLevel();
		BlockPos base = sky(h, 100);
		ServerPlayer p = player(h, Vec3.atCenterOf(base.above(4)), 0, -90);
		AABB box = new AABB(base).inflate(12);
		int tick = allPulsesTick(p);
		withCustomsOff(h, () -> withModeOff(h, () -> {
			h.assertTrue(!CustomEnchants.enabled(level), "switch reads OFF");

			// vein miner, chicken rain, midas touch, butterfingers on a break
			BlockPos cube = base.offset(4, 0, 4);
			fill(level, cube, cube.offset(2, 2, 2), Blocks.STONE.defaultBlockState());
			ItemStack pick = ench(h, Items.DIAMOND_PICKAXE, CustomEnchants.VEIN_MINER, 10);
			ench(h, pick, CustomEnchants.CHICKEN_RAIN, 20);
			ench(h, pick, CustomEnchants.MIDAS_TOUCH, 67);
			ench(h, pick, CustomEnchants.BUTTERFINGERS, 25);
			p.setItemInHand(InteractionHand.MAIN_HAND, pick);
			for (int i = 0; i < 10; i++) {
				level.setBlockAndUpdate(cube, Blocks.STONE.defaultBlockState());
				p.gameMode.destroyBlock(cube);
			}
			h.assertValueEqual(count(level, cube, cube.offset(2, 2, 2), Blocks.STONE), 26, "vein miner OFF: only the origin broke");
			h.assertValueEqual(entities(h, Chicken.class, box).size(), 0, "chicken rain OFF");
			h.assertValueEqual(itemCount(h, box, Items.GOLD_INGOT) + itemCount(h, box, Items.GOLD_NUGGET), 0, "midas touch OFF");
			h.assertTrue(p.getMainHandItem() == pick, "butterfingers OFF: the pickaxe stays in hand");
			h.assertTrue(CustomEnchants.level(pick, CustomEnchants.VEIN_MINER) == 10, "items keep their custom enchantments");
			clear(level, cube, cube.offset(2, 2, 2));

			// barrage + kaboom tagging: bow and snowball
			ItemStack bow = ench(h, Items.BOW, CustomEnchants.BARRAGE, 5);
			ench(h, bow, CustomEnchants.KABOOM, 3);
			p.setItemInHand(InteractionHand.MAIN_HAND, bow);
			p.getInventory().add(new ItemStack(Items.ARROW, 1));
			Items.BOW.releaseUsing(bow, level, p, 72000 - 30);
			List<AbstractArrow> arrows = owned(h, AbstractArrow.class, p.getBoundingBox().inflate(8), p);
			h.assertValueEqual(arrows.size(), 1, "barrage OFF: one arrow");
			h.assertTrue(arrows.get(0).entityTags().stream().noneMatch(t -> t.startsWith(Kaboom.TAG_PREFIX)), "kaboom OFF: arrow not tagged");
			arrows.forEach(Entity::discard);
			ItemStack snow = ench(h, new ItemStack(Items.SNOWBALL, 4), CustomEnchants.BARRAGE, 3);
			h.assertValueEqual(throwAndCount(h, p, snow, Snowball.class, p.getBoundingBox().inflate(8)), 1, "barrage OFF: one snowball");

			// kaboom: a tagged projectile that impacts while OFF does not explode
			Snowball tagged = new Snowball(EntityTypes.SNOWBALL, level);
			tagged.setPos(base.getX() + 0.5, base.getY() + 8, base.getZ() + 0.5);
			tagged.addTag(Kaboom.TAG_PREFIX + 3);
			level.addFreshEntity(tagged);
			int explosions = Kaboom.explosionsThisTick();
			Kaboom.onImpact(tagged);
			h.assertValueEqual(Kaboom.explosionsThisTick(), explosions, "kaboom OFF: no explosion");
			tagged.discard();

			// yeet and butterfingers on a melee hit, party popper on a kill
			Zombie zombie = mob(h, EntityTypes.ZOMBIE, p.position().add(1.5, 0, 0));
			zombie.setNoGravity(true);
			ItemStack sword = ench(h, Items.DIAMOND_SWORD, CustomEnchants.YEET, 5);
			ench(h, sword, CustomEnchants.BUTTERFINGERS, 25);
			ench(h, sword, CustomEnchants.PARTY_POPPER, 5);
			p.setItemInHand(InteractionHand.MAIN_HAND, sword);
			for (int i = 1; i <= 10; i++) {
				zombie.setHealth(zombie.getMaxHealth());
				zombie.setDeltaMovement(Vec3.ZERO);
				h.assertTrue(zombie.hurtServer(level, p.damageSources().playerAttack(p), i), "hit " + i + " landed");
				h.assertTrue(zombie.getDeltaMovement().y < 0.5, "yeet OFF: no launch, got " + zombie.getDeltaMovement());
			}
			h.assertTrue(p.getMainHandItem() == sword, "butterfingers OFF on hits");
			zombie.hurtServer(level, p.damageSources().playerAttack(p), 1000.0F);
			h.assertTrue(zombie.isDeadOrDying(), "zombie died");
			h.assertValueEqual(rockets(h, box).size(), 0, "party popper OFF: no rockets");

			// moon boots: no fall protection, no jump boost
			Zombie wearer = mob(h, EntityTypes.ZOMBIE, Vec3.atCenterOf(base.offset(4, 0, 4)));
			wearer.setNoGravity(true);
			wearer.setItemSlot(EquipmentSlot.FEET, ench(h, Items.LEATHER_BOOTS, CustomEnchants.MOON_BOOTS, 5));
			h.assertTrue(wearer.hurtServer(level, wearer.damageSources().fall(), 4.0F), "moon boots OFF: fall damage applies");
			wearer.discard();
			p.setItemSlot(EquipmentSlot.FEET, ench(h, Items.IRON_BOOTS, CustomEnchants.MOON_BOOTS, 5));

			// magnet and hiccups (periodic effects)
			p.setItemInHand(InteractionHand.OFF_HAND, ench(h, Items.STICK, CustomEnchants.MAGNET, 10));
			p.getInventory().setItem(20, ench(h, Items.STICK, CustomEnchants.HICCUPS, 20));
			ItemEntity drop = item(level, p.position().add(5, 0, 0), Items.DIRT);
			h.assertValueEqual(countHops(p, tick, 30), 0, "hiccups OFF: no hops");
			h.assertTrue(drop.getDeltaMovement().lengthSqr() < 1.0E-9, "magnet OFF: item not pulled");
			h.assertTrue(!p.hasEffect(MobEffects.JUMP_BOOST), "moon boots OFF: no Jump Boost");
			drop.discard();
		}));
		h.assertTrue(CustomEnchants.enabled(level), "switch restored ON");
		discardAll(h, Zombie.class, box);
		discardAll(h, ItemEntity.class, box);
		discardAll(h, ExperienceOrb.class, box);
		cleanup(p);
		h.succeed();
	}

	// ---------------------------------------------------------------- helpers

	/** Projectiles of {@code type} in {@code box} whose owner is {@code owner} (ignores neighbouring tests' projectiles). */
	private static <T extends Projectile> List<T> owned(GameTestHelper h, Class<T> type, AABB box, Entity owner) {
		return entities(h, type, box).stream().filter(e -> e.getOwner() == owner).toList();
	}

	private static boolean kaboomTagged(Entity e) {
		return e.entityTags().stream().anyMatch(t -> t.startsWith(Kaboom.TAG_PREFIX));
	}

	private static Snowball taggedSnowball(ServerLevel level, ServerPlayer owner, BlockPos base, int i) {
		Snowball s = new Snowball(EntityTypes.SNOWBALL, level);
		s.setOwner(owner);
		s.setPos(base.getX() + (i % 20) - 10, base.getY() + 4 + (i / 20), base.getZ() + 6);
		s.setNoGravity(true);
		s.addTag(Kaboom.TAG_PREFIX + 1);
		level.addFreshEntity(s);
		return s;
	}

	private static int inventoryLevels(ServerPlayer p) {
		int sum = 0;
		for (int i = ItemEnchanter.FIRST_SLOT; i <= ItemEnchanter.LAST_SLOT; i++) sum += totalLevels(p.getInventory().getItem(i));
		return sum;
	}

	private static int loyalty(GameTestHelper h, ItemStack stack) {
		return ItemEnchanter.getLevel(stack, TestSupport.ench(h, Enchantments.LOYALTY));
	}

	/** Uses {@code stack} from the main hand and returns how many projectiles of {@code type} are in {@code box}; discards them. */
	private static int throwAndCount(GameTestHelper h, ServerPlayer p, ItemStack stack, Class<? extends Projectile> type, AABB box) {
		p.setItemInHand(InteractionHand.MAIN_HAND, stack);
		stack.getItem().use(h.getLevel(), p, InteractionHand.MAIN_HAND);
		List<? extends Projectile> found = owned(h, type, box, p);
		found.forEach(Entity::discard);
		return found.size();
	}

	private static void breakRepeatedly(ServerLevel level, ServerPlayer p, BlockPos pos, Block block, int times) {
		for (int i = 0; i < times; i++) {
			level.setBlockAndUpdate(pos, block.defaultBlockState());
			p.gameMode.destroyBlock(pos);
		}
	}

	private static ItemEntity item(ServerLevel level, Vec3 pos, Item item) {
		ItemEntity e = new ItemEntity(level, pos.x, pos.y, pos.z, new ItemStack(item), 0, 0, 0);
		e.setNoGravity(false);
		level.addFreshEntity(e);
		return e;
	}

	private static int itemCount(GameTestHelper h, AABB box, Item item) {
		int n = 0;
		for (ItemEntity e : entities(h, ItemEntity.class, box)) if (e.getItem().is(item)) n += e.getItem().getCount();
		return n;
	}

	private static List<FireworkRocketEntity> rockets(GameTestHelper h, AABB box) {
		return entities(h, FireworkRocketEntity.class, box).stream().filter(r -> r.entityTags().contains(PartyPopper.TAG)).toList();
	}

	private static void assertDropped(GameTestHelper h, AABB box, ItemStack stack) {
		boolean found = false;
		for (ItemEntity e : entities(h, ItemEntity.class, box)) {
			if (e.getItem() == stack) {
				found = true;
				h.assertTrue(e.hasPickUpDelay(), "dropped item has a pickup delay");
			}
		}
		h.assertTrue(found, "the held stack lies on the ground as an item entity");
	}

	private static int jumpBoost(LivingEntity e) {
		MobEffectInstance effect = e.getEffect(MobEffects.JUMP_BOOST);
		return effect == null ? -1 : effect.getAmplifier();
	}

	/** Calls the periodic tick {@code rolls} times (always a Hiccups roll) and counts upward hops. */
	private static int countHops(ServerPlayer p, int tick, int rolls) {
		int hops = 0;
		for (int i = 0; i < rolls; i++) {
			p.setDeltaMovement(Vec3.ZERO);
			CustomEffects.tickPlayer(p, tick);
			if (p.getDeltaMovement().y > 0.4) hops++;
		}
		p.setDeltaMovement(Vec3.ZERO);
		return hops;
	}
}
