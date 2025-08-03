import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";

export const submitVideo = mutation({
  args: {
    videoUrl: v.string(),
    pitchShift: v.number(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to process videos");
    }

    // Validate pitch shift range
    if (args.pitchShift < -12 || args.pitchShift > 12) {
      throw new Error("Pitch shift must be between -12 and +12 semitones");
    }

    // Validate URL format
    const isYouTubeUrl = args.videoUrl.includes('youtube.com') || args.videoUrl.includes('youtu.be');
    if (!isYouTubeUrl && !args.videoUrl.match(/\.(mp4|webm|ogg|mov|avi)$/i)) {
      throw new Error("Please provide a YouTube URL or direct video file URL");
    }

    const videoId = await ctx.db.insert("videoProcessing", {
      userId,
      originalVideoUrl: args.videoUrl,
      pitchShift: args.pitchShift,
      title: args.title,
      status: "pending",
    });

    // Schedule the video processing
    await ctx.scheduler.runAfter(0, internal.videoProcessor.processVideo, {
      videoId,
    });

    return videoId;
  },
});

function extractYouTubeId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

export const getYouTubeInfo = action({
  args: {
    videoUrl: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const videoId = extractYouTubeId(args.videoUrl);
      if (!videoId) {
        throw new Error("Invalid YouTube URL");
      }

      // For now, return basic info. In production, you'd use YouTube API
      return {
        title: "YouTube Video",
        duration: "Unknown",
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        videoId,
      };
    } catch (error) {
      throw new Error("Failed to fetch YouTube video info");
    }
  },
});

export const getVideo = query({
  args: {
    videoId: v.id("videoProcessing"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.videoId);
  },
});

export const updateVideoStatus = mutation({
  args: {
    videoId: v.id("videoProcessing"),
    status: v.union(
      v.literal("pending"), 
      v.literal("processing"), 
      v.literal("completed"), 
      v.literal("failed")
    ),
    processedVideoUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.videoId, {
      status: args.status,
      processedVideoUrl: args.processedVideoUrl,
      errorMessage: args.errorMessage,
    });
  },
});

export const getUserVideos = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("videoProcessing")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);
  },
});
