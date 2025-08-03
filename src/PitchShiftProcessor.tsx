import { useState, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";

export function PitchShiftProcessor() {
  const [videoUrl, setVideoUrl] = useState("");
  const [pitchShift, setPitchShift] = useState(0);
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [youtubeInfo, setYoutubeInfo] = useState<any>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  
  const submitVideo = useMutation(api.videos.submitVideo);
  const getYouTubeInfo = useAction(api.videos.getYouTubeInfo);
  const userVideos = useQuery(api.videos.getUserVideos) || [];

  // Check if URL is YouTube and fetch info
  useEffect(() => {
    const isYouTubeUrl = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
    if (isYouTubeUrl && videoUrl.trim()) {
      const timeoutId = setTimeout(async () => {
        setIsLoadingInfo(true);
        try {
          const info = await getYouTubeInfo({ videoUrl: videoUrl.trim() });
          setYoutubeInfo(info);
          if (!title) {
            setTitle(info.title);
          }
        } catch (error) {
          console.error("Failed to fetch YouTube info:", error);
          setYoutubeInfo(null);
        } finally {
          setIsLoadingInfo(false);
        }
      }, 1000);
      return () => clearTimeout(timeoutId);
    } else {
      setYoutubeInfo(null);
    }
  }, [videoUrl, getYouTubeInfo, title]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) {
      toast.error("Please enter a video URL");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitVideo({ 
        videoUrl: videoUrl.trim(), 
        pitchShift,
        title: title.trim() || undefined
      });
      toast.success("Video submitted for processing!");
      setVideoUrl("");
      setTitle("");
      setPitchShift(0);
      setYoutubeInfo(null);
    } catch (error) {
      toast.error("Failed to submit video");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPitchLabel = (semitones: number) => {
    if (semitones === 0) return "Original pitch";
    if (semitones > 0) return `+${semitones} semitones (higher)`;
    return `${semitones} semitones (lower)`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "text-yellow-600 bg-yellow-50";
      case "processing": return "text-blue-600 bg-blue-50";
      case "completed": return "text-green-600 bg-green-50";
      case "failed": return "text-red-600 bg-red-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <div className="space-y-8">
      {/* Submission Form */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-2xl font-semibold mb-4">🎵 Process New Video</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Title (optional)
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My awesome video"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="videoUrl" className="block text-sm font-medium text-gray-700 mb-2">
              📺 Video URL * (YouTube or direct video file)
            </label>
            <input
              id="videoUrl"
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=... or https://example.com/video.mp4"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-shadow"
              disabled={isSubmitting}
              required
            />
            
            {/* YouTube Loading State */}
            {isLoadingInfo && (
              <div className="mt-3 flex items-center space-x-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Loading YouTube video info...</span>
              </div>
            )}
            
            {/* YouTube Preview */}
            {youtubeInfo && (
              <div className="mt-3 p-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg border border-red-200">
                <div className="flex space-x-4">
                  <img 
                    src={youtubeInfo.thumbnail} 
                    alt="Video thumbnail"
                    className="w-24 h-18 object-cover rounded-lg shadow-sm"
                  />
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 mb-1">{youtubeInfo.title}</h4>
                    <p className="text-sm text-gray-600 mb-1">⏱️ Duration: {youtubeInfo.duration}</p>
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        📺 YouTube
                      </span>
                      <span className="text-xs text-green-600">✓ Ready to process</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="pitchShift" className="block text-sm font-medium text-gray-700 mb-2">
              🎚️ Pitch Shift: {getPitchLabel(pitchShift)}
            </label>
            <input
              id="pitchShift"
              type="range"
              min="-12"
              max="12"
              step="1"
              value={pitchShift}
              onChange={(e) => setPitchShift(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              disabled={isSubmitting}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>-12 (much lower)</span>
              <span>0 (original)</span>
              <span>+12 (much higher)</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!videoUrl.trim() || isSubmitting}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {isSubmitting ? "🔄 Submitting..." : "🚀 Process Video"}
          </button>
        </form>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-800 mb-2">📋 How it works:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Paste any YouTube URL or direct video file link</li>
            <li>• Adjust the pitch slider (-12 to +12 semitones)</li>
            <li>• Click process and wait for your pitch-shifted video!</li>
          </ul>
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
              <strong>⚠️ Requirements:</strong> This app now uses real FFmpeg processing. You need:
            </p>
            <ul className="text-xs text-amber-600 mt-1 space-y-1">
              <li>• FFmpeg installed on your server</li>
              <li>• yt-dlp for YouTube video downloads</li>
              <li>• Sufficient storage space for video processing</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Processed Videos */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-2xl font-semibold mb-4">🎬 Your Processed Videos</h2>
        {userVideos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎵</div>
            <p className="text-gray-500 text-lg">No videos processed yet</p>
            <p className="text-gray-400 text-sm">Submit your first YouTube video above!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {userVideos.map((video) => (
              <div key={video._id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-800 mb-1">
                      {video.title || "Untitled Video"}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>🎚️ Pitch: {getPitchLabel(video.pitchShift)}</span>
                      <span>📅 {new Date(video._creationTime).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(video.status)}`}>
                    {video.status === "processing" && "⏳ "}
                    {video.status === "completed" && "✅ "}
                    {video.status === "failed" && "❌ "}
                    {video.status === "pending" && "⏸️ "}
                    {video.status.charAt(0).toUpperCase() + video.status.slice(1)}
                  </span>
                </div>

                {video.status === "processing" && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-blue-700">🎵 Processing audio pitch shift...</span>
                    </div>
                  </div>
                )}

                {video.status === "failed" && video.errorMessage && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">❌ Error: {video.errorMessage}</p>
                  </div>
                )}

                {video.status === "completed" && video.processedVideoUrl && (
                  <div className="space-y-4">
                    <video
                      controls
                      className="w-full max-w-3xl rounded-lg shadow-md"
                      preload="metadata"
                    >
                      <source src={video.processedVideoUrl} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href={video.processedVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                      >
                        ⬇️ Download Processed
                      </a>
                      <a
                        href={video.originalVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
                      >
                        🔗 View Original
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
