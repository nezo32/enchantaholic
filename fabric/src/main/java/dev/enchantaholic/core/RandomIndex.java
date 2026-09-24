package dev.enchantaholic.core;

/** Uniform int in [0, bound). Adapters: RandomSource::nextInt, java.util.Random::nextInt. */
@FunctionalInterface
public interface RandomIndex {
	int nextInt(int bound);
}
