import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content.trim()) {
    throw new ApiError(400, "Tweet should not be empty.");
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, "Author not found");
  }

  const tweet = await Tweet.create({
    content,
    owner: user._id,
  });

  const updatedTweet = await tweet.populate("owner", "username avatar");

  return res
    .status(200)
    .json(new ApiResponse(200, updatedTweet, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const tweets = await Tweet.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
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
    .json(new ApiResponse(200, tweets, "All tweets are fetched succefully"));
});

const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const { content } = req.body;

  if (!content.trim()) {
    throw new ApiError(400, "Content must not be empty");
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  if (tweet.owner.equals(req.user._id)) {
    tweet.content = content;
    const updatedTweet = await tweet.save();
    await updatedTweet.populate("owner", "username avatar");

    return res
      .status(200)
      .json(new ApiResponse(200, updatedTweet, "Tweet updated succesfully"));
  }
  throw new ApiError(403, "Permission denied");
});

const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  if (tweet.owner.equals(req.user._id)) {
    await tweet.deleteOne();
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Tweet deleted successfully"));
  }
  throw new ApiError(403, "Permission denied");
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
