"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import ffmpeg from "fluent-ffmpeg";
import fetch from "node-fetch";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";

async function downloadVideo(url: string, outputPath: string): Promise<void> {
  const isYouTubeUrl = url.includes('youtube.com') || url.includes('youtu.be');
  
  if (isYouTubeUrl) {
    // Use yt-dlp to download YouTube videos
    return new Promise((resolve, reject) => {
      const ytDlp = spawn('yt-dlp', [
        '-f', 'best[ext=mp4]',
        '-o', outputPath,
        url
      ]);

      ytDlp.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp failed with code ${code}. Make sure yt-dlp is installed.`));
        }
      });

      ytDlp.on('error', (error) => {
        reject(new Error(`Failed to start yt-dlp: ${error.message}. Make sure yt-dlp is installed.`));
      });
    });
  } else {
    // Download direct video file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    await fs.writeFile(outputPath, buffer);
  }
}

async function processVideoWithFFmpeg(
  ctx: any,
  videoUrl: string,
  pitchShift: number
): Promise<string> {
  const tempDir = tmpdir();
  const inputPath = join(tempDir, `input_${Date.now()}.mp4`);
  const outputPath = join(tempDir, `output_${Date.now()}.mp4`);

  try {
    // Download the video
    await downloadVideo(videoUrl, inputPath);

    // Calculate pitch shift factor
    // Each semitone is a factor of 2^(1/12)
    const pitchFactor = Math.pow(2, pitchShift / 12);

    // Process with FFmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters([
          {
            filter: 'asetrate',
            options: `44100*${pitchFactor}`
          },
          {
            filter: 'aresample',
            options: '44100'
          }
        ])
        .videoCodec('copy') // Keep original video
        .audioCodec('aac')
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}. Make sure FFmpeg is installed.`)))
        .run();
    });

    // Upload processed video to Convex storage
    const processedVideoBuffer = await fs.readFile(outputPath);
    const blob = new Blob([processedVideoBuffer], { type: 'video/mp4' });
    
    const storageId = await ctx.storage.store(blob);
    const processedVideoUrl = await ctx.storage.getUrl(storageId);

    // Clean up temporary files
    try {
      await fs.unlink(inputPath);
      await fs.unlink(outputPath);
    } catch (cleanupError) {
      console.warn("Failed to clean up temporary files:", cleanupError);
    }

    return processedVideoUrl;

  } catch (error) {
    // Clean up on error
    try {
      await fs.unlink(inputPath);
      await fs.unlink(outputPath);
    } catch (cleanupError) {
      console.warn("Failed to clean up temporary files:", cleanupError);
    }
    throw error;
  }
}

export const processVideo = internalAction({
  args: {
    videoId: v.id("videoProcessing"),
  },
  handler: async (ctx, args) => {
    // Update status to processing
    await ctx.runMutation(api.videos.updateVideoStatus, {
      videoId: args.videoId,
      status: "processing",
    });

    try {
      const video = await ctx.runQuery(api.videos.getVideo, {
        videoId: args.videoId,
      });

      if (!video) {
        throw new Error("Video not found");
      }

      // Process the video with real pitch shifting
      const processedVideoUrl = await processVideoWithFFmpeg(
        ctx,
        video.originalVideoUrl,
        video.pitchShift
      );

      await ctx.runMutation(api.videos.updateVideoStatus, {
        videoId: args.videoId,
        status: "completed",
        processedVideoUrl,
      });

    } catch (error) {
      console.error("Video processing failed:", error);
      await ctx.runMutation(api.videos.updateVideoStatus, {
        videoId: args.videoId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Processing failed",
      });
    }
  },
});


