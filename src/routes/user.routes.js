import { Router } from "express";

import { registerUser, logoutUser } from "../controllers/usercontroller.js";
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

export default router;
