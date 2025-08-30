import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

// For request body typing
export interface TypedRequestBody<T> extends Request {
  body: T;
}

// For request query typing - fixed version
export interface TypedRequestQuery<T extends ParsedQs> extends Request {
  query: T;
}

// Combined typed request with both body and query
export interface TypedRequest<T extends ParsedQs, U> extends Request {
  query: T;
  body: U;
}

export type ErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void;

// Add other types here