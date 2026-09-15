/*
 * What a pool's tick spacing means as a price.
 *
 * A tick is a coordinate on a grid of prices spaced 0.01% apart, and a pool
 * only lets a position's edges sit on every n-th tick. To a reader that is one
 * fact — how finely the edges can be placed — and it is a percentage, not a
 * count: spacing 60 means the usable edges are about 0.6% apart.
 */

/** The price ratio between one usable tick and the next: `1.0001^spacing − 1`. */
export const priceStepRatio = (tickSpacing: number): number => 1.0001 ** tickSpacing - 1;
