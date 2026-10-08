import { z } from "zod";
import { objectId } from "./common";

// userId is accepted for backwards compatibility but ignored: identity comes from the JWT
export const confirmMatchBody = z.object({ matchId: objectId, userId: z.string().optional() });
export const userIdParams = z.object({ userId: objectId });
