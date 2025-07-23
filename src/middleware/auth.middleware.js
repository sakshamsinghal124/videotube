import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import { ApiError } from "../utilss/ApiError.js";
import { asynchandler } from "../utilss/asynchandler.js";

export const verifyJwt = asynchandler(async (req, _, next) => {
  const token =
    req.cookies.token || req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return next(new ApiError("Authentication token is missing", 401));
  }

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decodedToken?.id).select(
      "-password -refreshToken"
    );

    if (!user) {
      return next(new ApiError("User not found", 404));
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError("Invalid access token", 401);
  }
});
