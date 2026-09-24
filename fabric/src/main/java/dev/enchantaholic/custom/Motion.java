package dev.enchantaholic.custom;

import net.minecraft.network.protocol.game.ClientboundSetEntityMotionPacket;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.phys.Vec3;

/**
 * Sets an entity's velocity so that clients see it right away, on 26.2 and 26.3 alike (the
 * "velocity changed" flag is hurtMarked in 26.2 and syncVelocity in 26.3, so it is not used).
 */
public final class Motion {
	private Motion() {}

	public static void set(Entity entity, Vec3 velocity) {
		entity.setDeltaMovement(Vec3.ZERO);
		entity.push(velocity); // push() flags the entity for a motion update to trackers
		if (entity instanceof ServerPlayer player) {
			player.connection.send(new ClientboundSetEntityMotionPacket(player)); // players own their motion client-side
		}
	}
}
