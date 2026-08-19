import type { Request, Response } from "express";
import { authService } from "../services/auth.service.js";

export const authController = {
  login: async (req: Request, res: Response) =>
    res.json(await authService.login(req.body.identifier, req.body.password)),

  register: async (req: Request, res: Response) =>
    res.status(201).json(await authService.register(req.body)),


  forgotPassword: async (req: Request, res: Response) =>
    res.json(await authService.forgotPassword(req.body.identifier)),

  resetPassword: async (req: Request, res: Response) =>
    res.json(await authService.resetPassword(req.body.token, req.body.newPassword)),

  changePassword: async (req: Request, res: Response) =>
    res.json(await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword)),

  me: async (req: Request, res: Response) =>
    res.json(await authService.me(req.user!.id)),

  updateProfile: async (req: Request, res: Response) =>
    res.json(await authService.updateProfile(req.user!.id, req.body)),
};
