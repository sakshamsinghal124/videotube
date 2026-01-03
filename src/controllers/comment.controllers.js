import mongoose from "mongoose";
import { Comment } from "../models/comment.models.js";
import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video file not found");
  }

  const count = page * limit;

  if (!count) {
    throw new ApiError(400, "Minimum 1 document should be asked");
  }
  const comments = await Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $sort: {
        createdAt: -1,
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
    {
      $limit: count,
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        comments,
        "All comments for the video fetched succesfully"
      )
    );
});

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) {
    throw new ApiError(400, "Comment should not be empty");
  }

  try {
    const comment = await Comment.create({
      content,
      video: videoId,
      owner: req.user?._id,
    });

    return res.status(201).json(
      new ApiResponse(
        200,
        {
          comment,
        },
        "Comment added successfully"
      )
    );
  } catch (error) {
    console.log("Error while creating comment", error);
    throw new ApiError(400, "Comment not created");
  }
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) {
    throw new ApiError(400, "Comment should not be empty");
  }

  const comment = await Comment.findByIdAndUpdate(
    commentId,
    {
      $set: {
        content: content,
      },
    },
    {
      new: true,
    }
  );

  res
    .status(200)
    .json(new ApiResponse(200, comment, "Comment updated successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  try {
    const comment = await Comment.deleteOne({ _id: commentId });
    console.log(comment);
    res.status(200).json(
      new ApiResponse(
        200,
        {
          "Comment deleted": comment.deletedCount,
        },
        "Comment deleted succesfully"
      )
    );
  } catch (error) {
    console.log("Error occurred while deleting comment", error);
    throw new ApiError(400, "Comment not deleted");
  }
});

export { getVideoComments, addComment, updateComment, deleteComment };
