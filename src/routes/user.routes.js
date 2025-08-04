import { Router } from "express";

import {
  registerUser,
  logoutUser,
  loginUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  getUserChanel,
  updateAccountDetails,
  updateUserAvatar,
} from "../controllers/usercontroller.js";
import { verifyJwt } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),

  registerUser
);

//secured routes

router.route("/logout").post(verifyJwt, logoutUser);

router.route("/change-password").post(verifyJwt, changeCurrentPassword);

router.route("/current-user").get(verifyJwt, getCurrentUser);

router.route("/c/:username").get(verifyJwt, getUserChanel);

router.route("/update-account").patch(verifyJwt, updateAccountDetails);

router
  .route("/update-account/cover-image")
  .patch(verifyJwt, upload.single("coverImage"), updateUserCoverImage);

router
  .route("/update-account/avatar")
  .patch(verifyJwt, upload.single("avatar"), updateUserAvatar);

router.route("/watch-history").get(verifyJwt, getWatchHistory);

//unsecured routes
router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);

export default router;
