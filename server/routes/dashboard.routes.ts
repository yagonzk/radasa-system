import{Router}from"express";
import{asyncHandler}from"../utils/async-handler.js";
import{dashboardController as c}from"../controllers/dashboard.controller.js";
export const dashboardRoutes=Router();
dashboardRoutes.get("/gerencial",asyncHandler(c.gerencial));
dashboardRoutes.get("/financeiro",asyncHandler(c.financeiro));
dashboardRoutes.get("/rankings",asyncHandler(c.rankings));
dashboardRoutes.get("/alertas",asyncHandler(c.alertas));
