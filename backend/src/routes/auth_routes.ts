import express from "express";
import authController from "../controllers/auth_controller";
import { asyncHandler } from "../lib/async-handler";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { authLimiter } from "../middleware/security";
import { validate } from "../middleware/validate";
import { googleBody, loginBody, refreshBody, registerBody, updateUserBody } from "../schemas/auth.schema";
import { idParams } from "../schemas/common";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: The Authentication API
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated user ID
 *         email:
 *           type: string
 *           description: The user email
 *         password:
 *           type: string
 *           description: The user password
 *         name:
 *           type: string
 *           description: The user's name
 *         profilePic:
 *           type: string
 *           description: URL to user's profile picture
 *       example:
 *         email: 'test@gmail.com'
 *         password: '12345678'
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: User registration
 *     description: Register a new user with email, password, and username.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "newuser@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *               userName:
 *                 type: string
 *                 example: "newuser123"
 *     responses:
 *       200:
 *         description: User successfully registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 userName:
 *                   type: string
 *       400:
 *         description: Registration error
 */
router.post("/register", authLimiter, validate({ body: registerBody }), asyncHandler(authController.register));

/**
 * @swagger
 * /auth/google:
 *   post:
 *     summary: Sign in or register with Google
 *     tags: [Auth]
 *     description: Authenticate user with Google credentials
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Google ID token
 *     responses:
 *       200:
 *         description: Successfully authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 _id:
 *                   type: string
 *                   example: 678662a4880602a32720075c
 *       400:
 *         description: Invalid Google token
 *       500:
 *         description: Server error
 */
router.post("/google", authLimiter, validate({ body: googleBody }), asyncHandler(authController.googleSignIn));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user with email and password.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "newuser@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     userName:
 *                       type: string
 *       400:
 *         description: Invalid credentials
 */
/**
 * @swagger
 * /auth/demo:
 *   post:
 *     summary: Start a demo session
 *     description: Creates a private, temporary visitor account with a ready scenario (a lost item, an AI match with a found item and a waiting chat message) and signs it in. Visitor sandboxes are invisible to everyone else and are removed after 24 hours.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: "{ accessToken, refreshToken, _id, matchId }"
 *       429:
 *         description: Too many requests
 *       503:
 *         description: DEMO_UNAVAILABLE (not seeded yet) or DEMO_BUSY (visitor cap reached)
 */
router.post("/demo", authLimiter, asyncHandler(authController.demoSignIn));

router.post("/login", authLimiter, validate({ body: loginBody }), asyncHandler(authController.login));

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh tokens
 *     description: Refresh access and refresh tokens using the provided refresh token
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 refreshToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Invalid refresh token
 *       500:
 *         description: Server error
 */
router.post("/refresh", authLimiter, validate({ body: refreshBody }), asyncHandler(authController.refresh));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: User logout
 *     description: Logout user and invalidate the refresh token
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Successful logout
 *       400:
 *         description: Invalid refresh token
 *       500:
 *         description: Server error
 */
router.post("/logout", validate({ body: refreshBody }), asyncHandler(authController.logout));

/**
 * @swagger
 * /auth/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Auth]
 *     description: Retrieve a user by their ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       400:
 *         description: Bad request
 */
router.get("/:id", optionalAuth, validate({ params: idParams }), asyncHandler(authController.getUserById));


/**
 * @swagger
 * /auth/{id}:
 *   put:
 *     summary: Update user by ID
 *     tags: [Auth]
 *     description: Update a user's information by their ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               userName:
 *                 type: string
 *               imgURL:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       400:
 *         description: Bad request
 */
router.put("/:id", requireAuth, validate({ params: idParams, body: updateUserBody }), asyncHandler(authController.updateUser));

/**
 * @swagger
 * /auth/{id}:
 *   delete:
 *     summary: Delete user by ID
 *     tags: [Auth]
 *     description: Delete a user by their ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       400:
 *         description: Bad request
 */
router.delete("/:id", requireAuth, validate({ params: idParams }), asyncHandler(authController.deleteUser));

export default router;