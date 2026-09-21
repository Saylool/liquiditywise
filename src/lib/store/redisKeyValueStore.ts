import type { KeyValueStore } from "./keyValueStore";
import type { RedisClient } from "./redisClient";

/*
 * The store, spoken to a Redis directly.
 *
 * This is the one that runs on the server: the database is a process on the
 * same machine, reached over loopback, and the addresses readers link stay
 * on hardware that belongs to them. The REST store next door speaks the same
 * six commands to a database somewhere else, and exists for a deployment
 * that has nowhere to run one.
 *
 * Every reply is checked for the shape the command should have produced.
 * Redis answering `SET` with an integer is not something that happens, but
 * "not something that happens" is exactly what a store reached through the
 * wrong port, or a stream read half a reply out of step, looks like.
 */
export const createRedisKeyValueStore = (client: RedisClient): KeyValueStore => ({
  get: async (key) => {
    const reply = await client.command(["GET", key]);
    if (reply === null) return undefined;
    if (reply.kind === "null") return null;

    return reply.kind === "string" ? reply.value : undefined;
  },

  set: async (key, value, ttlMs) => {
    /*
     * `PX` rather than `EX`: the lifetimes here are written in milliseconds
     * by the callers, and rounding half an hour to the nearest second would
     * be a silent second rule about how long a pending link lives.
     */
    const args =
      ttlMs === undefined ? ["SET", key, value] : ["SET", key, value, "PX", String(ttlMs)];

    const reply = await client.command(args);

    return reply !== null && reply.kind === "string" && reply.value === "OK";
  },

  del: async (key) => {
    const reply = await client.command(["DEL", key]);

    /*
     * Zero is success: the key is gone, which is what was asked for, and a
     * caller that treated "there was nothing to delete" as a failure would
     * make forgetting a link that had already expired look like an error.
     */
    return reply !== null && reply.kind === "integer";
  },

  sadd: async (key, member) => {
    const reply = await client.command(["SADD", key, member]);

    return reply !== null && reply.kind === "integer";
  },

  srem: async (key, member) => {
    const reply = await client.command(["SREM", key, member]);

    return reply !== null && reply.kind === "integer";
  },

  smembers: async (key) => {
    const reply = await client.command(["SMEMBERS", key]);
    if (reply === null) return null;

    /* A set that does not exist answers as an empty array, not as null. */
    if (reply.kind !== "array") return null;

    const members: string[] = [];
    for (const value of reply.values) {
      // One member that is not a string means this is not the set it asked
      // for, and half a set is worse than none: the checker would drop the
      // links it could not see from the very set it is walking.
      if (value.kind !== "string") return null;
      members.push(value.value);
    }

    return members;
  },
});
