import { Router } from "express";
// import { wrapHandler } from "@medusajs/medusa";
import onboardingRoutes from "./onboarding";
import customRouteHandler from "./custom-route-handler";
import retriggerOrderEmail from "./retrigger-order-email";
import { wrapHandler } from "@medusajs/utils"

// Initialize a custom router
const router = Router();

export function attachAdminRoutes(adminRouter: Router) {
  // Attach our router to a custom path on the admin router
  adminRouter.use("/custom", router);

  // Define a GET endpoint on the root route of our custom path
  router.get("/", wrapHandler(customRouteHandler));

  // Define a GET endpoint on the root route of our custom path
  router.post("/retrigger-order-email", wrapHandler(retriggerOrderEmail));

  // Attach routes for onboarding experience, defined separately
  onboardingRoutes(adminRouter);
}
