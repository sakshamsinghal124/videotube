import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query,
    sortBy = "createdAt",
    sortType = "asc",
    userId,
  } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  const filter = { isPublished: true };

  if (query) {
    filter.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ];
  }

  if (userId) {
    filter.owner = userId;
  }

  const sortOptions = {};
  if (sortBy) {
    sortOptions[sortBy] = sortType === "asc" ? 1 : -1;
  }

  const videos = await Video.find(filter)
    .sort(sortOptions)
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .populate("owner", "username avatar");

  const total = await Video.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        videos,
      },
      "Videos fetched succesfully"
    )
  );
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title?.trim() && !description?.trim()) {
    throw ApiError(400, "Title or description shouldn't be empty");
  }

  const videoLocalPath = req.files?.video?.[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

  if (!videoLocalPath && !thumbnailLocalPath) {
    throw new ApiError(400, "video or thumbnail file is missing");
  }

  const options = {
    resource_type: "auto",
    folder: "VideoTube/videos/",
  };

  let video;
  try {
    video = await uploadOnCloudinary(videoLocalPath, options);
    console.log("Uploaded video", video);
  } catch (error) {
    console.log("Error uploading video", error);
    throw new ApiError(500, "Failed to upload video");
  }

  let thumbnail;
  try {
    thumbnail = await uploadOnCloudinary(thumbnailLocalPath, options);
    console.log("Uploaded thumbnail", thumbnail);
  } catch (error) {
    console.log("Error uploading thumbnail", error);
    throw new ApiError(500, "Failed to upload thumbnail");
  }

  try {
    const videos = await Video.create({
      videoFile: video.url,
      videoPublic_id: video.public_id,
      thumbnail: thumbnail.url,
      thumbnailPublic_id: thumbnail.public_id,
      title,
      description,
      duration: video.duration,
      owner: req.user._id,
    });

    if (!videos) {
      throw new ApiError(500, "Something went wrong while uploading video");
    }

    return res
      .status(201)
      .json(new ApiResponse(201, videos, "Video uploaded succesfully"));
  } catch (error) {
    console.log("Error, while uploading video", error);
    if (video) {
      await deleteFromCloudinary(video.public_id);
    }
    if (thumbnail) {
      await deleteFromCloudinary(thumbnail.public_id);
    }
    throw new ApiError(500, "Something went wrong while storing video");
  }
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  let video = await Video.findByIdAndUpdate(
    videoId,
    { $inc: { views: 1 } },
    { new: true }
  );

  if (!video) {
    throw new ApiError(400, "Video file not found");
  }

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $addToSet: { watchHistory: videoId },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken");

  video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
        isPublished: true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              fullname: 1,
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video successfuly fetched"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const { title, description } = req.body;

  let video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video file not found");
  }

  const thumbnailLocalPath = req.file?.path;

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "Thumbnail file is missing");
  }

  const options = {
    resource_type: "auto",
    folder: "VideoTube/videos/",
  };

  let thumbnail;
  try {
    thumbnail = await uploadOnCloudinary(thumbnailLocalPath, options);
    console.log("Uploaded thumbnail", thumbnail);
    await deleteFromCloudinary(video.thumbnailPublic_id);
  } catch (error) {
    console.log("Error uploading thumbnail", error);
    throw new ApiError(500, "Failed to upload thumbnail");
  }

  video = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: thumbnail.url,
        thumbnailPublic_id: thumbnail.public_id,
      },
    },
    {
      new: true,
    }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video details updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video file not found");
  }

  try {
    await deleteFromCloudinary(video.videoPublic_id, {
      resource_type: "video",
    });
    await deleteFromCloudinary(video.thumbnailPublic_id);
    await Video.findByIdAndDelete(videoId);
  } catch (error) {
    console.log("Error occurred while deleting video", error);
    throw new ApiError(400, "Something happend while deleting the video.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted succesfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video file not found");
  }

  if (video.owner.equals(req.user._id)) {
    video.isPublished = !video.isPublished;
    await video.save();
    return res
      .status(200)
      .json(
        new ApiResponse(200, video, "Published status updated succesfully")
      );
  }
  throw new ApiError(403, "Unable to complete the request, permission denied");
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
