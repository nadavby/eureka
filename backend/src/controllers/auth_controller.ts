import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { HydratedDocument } from "mongoose";
import userModel, { iUser } from "../models/user_model";
import matchModel from "../models/match_model";
import { config } from "../lib/config";
import { AppError, badRequest, conflict, forbidden, notFound, unauthorized } from "../lib/errors";
import { issueTokens, verifyToken } from "../lib/tokens";
import { createVisitor } from "../demo/scenario";

const BCRYPT_ROUNDS = 10;
const googleClient = new OAuth2Client();

type UserDoc = HydratedDocument<iUser>;

const invalidCredentials = () => new AppError(401, "INVALID_CREDENTIALS", "Email or password incorrect");

/** Issues a token pair and stores the refresh token on the user (one entry per session). */
const startSession = async (user: UserDoc) => {
  const tokens = issueTokens(user._id.toString());
  user.refreshToken = [...(user.refreshToken ?? []), tokens.refreshToken];
  await user.save();
  return tokens;
};

/** Verifies a refresh token and returns its user. Reusing a revoked token signs the user out everywhere. */
const userFromRefreshToken = async (refreshToken: string) => {
  let userId: string;
  try {
    userId = verifyToken(refreshToken, "refresh");
  } catch {
    throw unauthorized("Invalid refresh token");
  }
  const user = await userModel.findById(userId);
  if (!user) throw notFound("User not found");
  if (!user.refreshToken?.includes(refreshToken)) {
    user.refreshToken = [];
    await user.save();
    throw unauthorized("Refresh token has been revoked");
  }
  return user;
};

const register = async (req: Request, res: Response) => {
  const { email, password, userName, phoneNumber, imgURL } = req.body;
  if (await userModel.exists({ userName })) throw conflict("User name already exists");
  if (await userModel.exists({ email })) throw conflict("email already exists");
  const user = await userModel.create({
    email,
    userName,
    phoneNumber,
    imgURL: imgURL ?? null,
    password: await bcrypt.hash(password, BCRYPT_ROUNDS),
  });
  res.status(200).json(user);
};

const login = async (req: Request, res: Response) => {
  const user = await userModel.findOne({ email: req.body.email });
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) throw invalidCredentials();
  const tokens = await startSession(user);
  res.status(200).json({ ...tokens, _id: user._id });
};

const googleSignIn = async (req: Request, res: Response) => {
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: req.body.credential,
      audience: config.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw badRequest("Invalid Google credential");
  }
  if (!payload?.email) throw badRequest("Invalid credentials");

  const email = payload.email.toLowerCase();
  let user = await userModel.findOne({ email });
  if (!user) {
    // Google accounts have no local password; a random hash makes password login impossible.
    const baseName = (payload.name || email.split("@")[0]).slice(0, 30);
    const taken = await userModel.exists({ userName: baseName });
    user = await userModel.create({
      email,
      password: await bcrypt.hash(randomUUID(), BCRYPT_ROUNDS),
      imgURL: payload.picture,
      userName: taken ? `${baseName}-${randomUUID().slice(0, 4)}` : baseName,
      phoneNumber: " ",
    });
  }
  const tokens = await startSession(user);
  res.status(200).json({
    email: user.email,
    _id: user._id,
    imgUrl: user.imgURL,
    userName: user.userName,
    ...tokens,
  });
};

const refresh = async (req: Request, res: Response) => {
  const user = await userFromRefreshToken(req.body.refreshToken);
  user.refreshToken = (user.refreshToken ?? []).filter((t) => t !== req.body.refreshToken);
  const tokens = await startSession(user);
  res.status(200).json(tokens);
};

const logout = async (req: Request, res: Response) => {
  const user = await userFromRefreshToken(req.body.refreshToken);
  user.refreshToken = (user.refreshToken ?? []).filter((t) => t !== req.body.refreshToken);
  await user.save();
  res.status(200).json({ message: "Logged out" });
};

/** Contact details are shared only once both owners confirmed a match between them. */
const sharesConfirmedMatch = async (a: string, b: string) =>
  !!(await matchModel.exists({
    confirmedAt: { $exists: true },
    $or: [
      { userId1: a, userId2: b },
      { userId1: b, userId2: a },
    ],
  }));

/** Contact details (email, phone) are visible only to the user themself and to users they share a confirmed match with. */
const getUserById = async (req: Request, res: Response) => {
  const user = await userModel.findById(req.params.id);
  if (!user) throw notFound("User not found");
  const viewer = req.user?.id;
  const canSeeContact = !!viewer && (viewer === req.params.id || (await sharesConfirmedMatch(viewer, req.params.id)));
  if (canSeeContact) {
    res.json(user);
    return;
  }
  res.json({ _id: user._id, userName: user.userName, imgURL: user.imgURL });
};

const demoReadOnly = () => new AppError(403, "DEMO_READONLY", "Demo accounts can't be changed");

const updateUser = async (req: Request, res: Response) => {
  if (req.user!.id !== req.params.id) throw forbidden("You can only edit your own profile");
  if (await userModel.exists({ _id: req.params.id, demoRole: { $exists: true } })) throw demoReadOnly();
  const update = { ...req.body };
  if (update.password) update.password = await bcrypt.hash(update.password, BCRYPT_ROUNDS);
  if (update.userName && (await userModel.exists({ userName: update.userName, _id: { $ne: req.params.id } }))) {
    throw conflict("User name already exists");
  }
  const user = await userModel.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!user) throw notFound("User not found");
  res.json(user);
};

const deleteUser = async (req: Request, res: Response) => {
  if (req.user!.id !== req.params.id) throw forbidden("You can only delete your own account");
  if (await userModel.exists({ _id: req.params.id, demoRole: { $exists: true } })) throw demoReadOnly();
  const user = await userModel.findByIdAndDelete(req.params.id);
  if (!user) throw notFound("User not found");
  res.json({ message: "User deleted" });
};

/** "Try the demo": a fresh private sandbox with a ready match, signed in. */
const demoSignIn = async (_req: Request, res: Response) => {
  const { visitor, matchId } = await createVisitor();
  const tokens = await startSession(visitor);
  res.status(200).json({ ...tokens, _id: visitor._id, matchId });
};

export default { register, login, googleSignIn, refresh, logout, getUserById, updateUser, deleteUser, demoSignIn };
