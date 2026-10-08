import { RequestHandler } from "express";
import { ZodTypeAny } from "zod";

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
