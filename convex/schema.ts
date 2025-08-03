import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  videoProcessing: defineTable({
    userId: v.id("users"),
    originalVideoUrl: v.string(),
    processedVideoUrl: v.optional(v.string()),
    pitchShift: v.number(), // semitones to shift (-12 to +12)
    status: v.union(
      v.literal("pending"), 
      v.literal("processing"), 
      v.literal("completed"), 
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
    title: v.optional(v.string()),
    // YouTube-specific fields
    youtubeVideoId: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    duration: v.optional(v.string()),
    isYouTubeVideo: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
