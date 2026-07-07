import jwt from "jsonwebtoken";
import { config } from "../config";

export interface JwtPayload {
  userId: string;
  role: "ADMIN" | "EMPLOYEE";
  employeeId?: string;
}

export function signToken(payload: JwtPayload, rememberMe = false): string {
  const expiresIn = rememberMe ? config.jwtRememberExpiresIn : config.jwtExpiresIn;
  return jwt.sign(payload, config.jwtSecret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}
