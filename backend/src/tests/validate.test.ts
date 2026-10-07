import express from "express";
import request from "supertest";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { errorHandler } from "../middleware/error-handler";
import { objectId } from "../schemas/common";

const app = express();
app.use(express.json());
app.post(
  "/x/:id",
  validate({ params: z.object({ id: objectId }), body: z.object({ n: z.coerce.number().max(5) }).strict() }),
  (req, res) => { res.json({ body: req.body, id: req.params.id }); }
);
app.use(errorHandler);

describe("validate", () => {
  it("passes parsed values through", async () => {
    const res = await request(app).post("/x/507f1f77bcf86cd799439011").send({ n: "3" });
    expect(res.body).toEqual({ body: { n: 3 }, id: "507f1f77bcf86cd799439011" });
  });

  it("rejects bad ids, bad values and unknown keys", async () => {
    expect((await request(app).post("/x/123").send({ n: 1 })).status).toBe(400);
    expect((await request(app).post("/x/507f1f77bcf86cd799439011").send({ n: 9 })).status).toBe(400);
    expect((await request(app).post("/x/507f1f77bcf86cd799439011").send({ n: 1, userId: "evil" })).status).toBe(400);
  });
});
