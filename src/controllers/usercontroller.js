import { asynchandler } from "../utilss/asynchandler.js";
import { ApiError } from "../utilss/ApiError.js";
import { User } from "../models/user.models.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utilss/cloudinary.js";
import { ApiResponse } from "../utilss/ApiResponse.js";
import { application } from "express";
import jwt from "jsonwebtoken";

const generateAccessAndrefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(410, "User not found");
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh tokens"
    );
  }
};

const registerUser = asynchandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }
  console.warn(req.files);
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  let avatar;
  try {
    avatar = await uploadOnCloudinary(avatarLocalPath);
    console.log("Uploaded avatar", avatar);
  } catch (error) {
    console.log("Error uploading avatar", error);
    throw new ApiError(500, "Failed to upload avatar");
  }

  let coverImage;
  try {
    coverImage = await uploadOnCloudinary(coverLocalPath);
    console.log("Uploaded Cover Image", coverImage);
  } catch (error) {
    console.log("Error uploading cover image");
    throw new ApiError(500, "Failed to upload cover image");
  }

  try {
    const user = User.create({
      fullname,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username: username.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select(
      "- password - refreshToken"
    );
    if (!createdUser) {
      throw new ApiError(500, "Something went wrong while registering user");
    }

    return res
      .status(201)
      .json(new ApiResponse(200, createdUser, "user registered successfully"));
  } catch (error) {
    console.log("User Creation failed");
    if (avatar) {
      await deleteFromCloudinary(avatar.public_id);
    }
    if (coverImage) {
      await deleteFromCloudinary(coverImage.public_id);
    }
    throw new ApiError(
      500,
      "Something went wrong while registering user and images were deleted"
    );
  }
});

const loginUser = asynchandler(async (req, res) => {
  // get data from body
  const { email, username, password } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  //validate password

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }
  const { accessToken, refreshToken } = await generateAccessAndrefreshToken(
    user._id
  );

  const LoggedInUser = await User.findById(user._id).select(
    "-password -refreshtoken"
  );

  if (!LoggedInUser) {
    throw new ApiError(404, "Cant login the user");
  }

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: LoggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

const logoutUser = asynchandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      refreshToken: "",
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asynchandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(404, "Invalid refresh token");
    }

    if (user.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Invalid refresh token");
    }
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndrefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(500, "Failed to refresh access token");
  }
});

const changeCurrentPassword = asynchandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);
  const isPasswordValid = user.isPasswordCorrect(currentPassword);

  if (!isPasswordValid) {
    throw new ApiError(401, "Current password is incorrect");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asynchandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const updateAccountDetails = asynchandler(async (req, res) => {
  const { fullname, email, username } = req.body;

  if (!fullname || !email || !username) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email,
        username,
      },
    },
    { new: true }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asynchandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, "Failed to upload avatar");
  }
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Avatar updated successfully"));
});

const updateUserCoverImage = asynchandler(async (req, res) => {
  const coverLocalPath = req.file?.path;
  if (!coverLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }
  const coverImage = await uploadOnCloudinary(coverLocalPath);
  if (!coverImage.url) {
    throw new ApiError(400, "Failed to upload cover image");
  }
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Cover image updated successfully"));
});

export {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  updateUserCoverImage,
  updateUserAvatar,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
};
