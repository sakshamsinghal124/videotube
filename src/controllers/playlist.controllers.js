import { Playlist } from "../models/playlist.models.js";
import { Video } from "../models/video.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.models.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name.trim() || !description.trim()) {
    throw new ApiError(400, "Name and description field should not be empty");
  }

  const playlist = await Playlist.create({
    name,
    description,
    videos: [],
    owner: req.user._id,
  });

  const updatedPlaylist = await Playlist.findById(playlist._id).populate(
    "owner",
    "username avatar"
  );

  return res
    .status(201)
    .json(
      new ApiResponse(201, updatedPlaylist, "New playlist created successfully")
    );
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const playlist = await Playlist.find({ owner: userId })
    .sort({ createdAt: -1 })
    .populate("owner", "username avatar")
    .populate(
      "videos",
      "videoFile thumbnail title description duration views likes"
    );

  if (!playlist.length) {
    throw new ApiError(404, "No playlist found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist fetched successfully"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  const playlist = await Playlist.findById(playlistId)
    .populate("owner", "username avatar")
    .populate(
      "videos",
      "videoFile thumbnail title description duration views likes"
    );

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist fetched Successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Video owner and playlist owner should be same");
  }

  const playlist = await Playlist.findById(playlistId)
    .populate("owner", "username avatar")
    .populate(
      "videos",
      "videoFile thumbnail title description duration views likes"
    );

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner._id.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not able to add videos in this playlist");
  }

  if (playlist.videos.some((v) => v._id.toString() === videoId)) {
    return res
      .status(200)
      .json(new ApiResponse(200, playlist, "Video already in the playlist"));
  }
  playlist.videos.push(videoId);
  await playlist.save();

  const updatedPlaylist = await Playlist.findById(playlistId)
    .populate("owner", "username avatar")
    .populate(
      "videos",
      "videoFile thumbnail title description duration views likes"
    );

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
    );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const playlist = await Playlist.findById(playlistId)
    .populate("owner", "username avatar")
    .populate(
      "videos",
      "videoFile thumbnail title description duration views likes"
    );

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner._id.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Access denied");
  }

  playlist.videos = playlist.videos.filter(
    (vid) => vid._id.toString() !== videoId
  );

  await playlist.save();

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlist, "Video removed from playlist successfully")
    );
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Access denied");
  }

  await Playlist.findByIdAndDelete(playlistId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Playlist deleted Successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;

  if (!playlistId) {
    throw new ApiError(400, "Playlist ID is required");
  }

  if (!name.trim() && !description.trim()) {
    throw new ApiError(
      400,
      "Name or description is required to update the playlist"
    );
  }

  const playlist = await Playlist.findById(playlistId)
    .populate("owner", "username avatar")
    .populate(
      "videos",
      "videoFile thumbnail title description duration views likes"
    );

  if (!playlist) {
    throw new ApiError(400, "Playlist not found");
  }

  if (playlist.owner._id.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Access denied");
  }

  if (name) playlist.name = name;
  if (description) playlist.description = description;

  await playlist.save();

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist updated successfully"));
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
