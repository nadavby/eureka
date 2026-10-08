import jwt, { JwtPayload } from "jsonwebtoken";
import { randomUUID } from "crypto";
import { config } from "./config";

type TokenType = "access" | "refresh";
interface Claims extends JwtPayload {
  _id: string;
  typ: TokenType;
}

const sign = (userId: string, typ: TokenType, expiresIn: string) =>
  jwt.sign({ _id: userId, typ }, config.TOKEN_SECRET, {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
    jwtid: randomUUID(),
  });

export const signAccessToken = (userId: string) => sign(userId, "access", config.TOKEN_EXPIRATION);
export const signRefreshToken = (userId: string) => sign(userId, "refresh", config.REFRESH_TOKEN_EXPIRATION);

export const issueTokens = (userId: string) => ({
  accessToken: signAccessToken(userId),
  refreshToken: signRefreshToken(userId),
});

/** Returns the user id. Throws jsonwebtoken errors (TokenExpiredError / JsonWebTokenError) or Error("wrong token type"). */
export const verifyToken = (token: string, typ: TokenType): string => {
  const payload = jwt.verify(token, config.TOKEN_SECRET) as Claims;
  if (payload.typ !== typ || typeof payload._id !== "string") throw new Error("wrong token type");
  return payload._id;
};
