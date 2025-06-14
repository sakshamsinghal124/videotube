import { ApiResponse } from "../utilss/ApiResponse.js";
import { asynchandler } from "../utilss/asynchandler.js";

const healthcheck = asynchandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, "OK", "Health check passed"));
});

export { healthcheck };
