import {
	createHmac,
	createHash,
	randomBytes,
	randomUUID,
	scrypt,
	timingSafeEqual,
} from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "./config";
import { dataStore } from "./data-store";

export interface AdminIdentity {
	email: string;
	role: "admin";
}

interface TokenPayload extends AdminIdentity {
	iat: number;
	exp: number;
	jti: string;
}

const scryptOptions = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const passwordKeyLength = 64;

const activeSessions = new Map<string, number>();

function safeEqual(left: string, right: string): boolean {
	const leftHash = createHash("sha256").update(left).digest();
	const rightHash = createHash("sha256").update(right).digest();
	return timingSafeEqual(leftHash, rightHash);
}

function sign(encodedPayload: string): string {
	return createHmac("sha256", config.authTokenSecret)
		.update(encodedPayload)
		.digest("base64url");
}

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(password, salt, passwordKeyLength, scryptOptions, (error, key) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(key);
		});
	});
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await derivePasswordKey(password, salt);
	return `scrypt$${scryptOptions.N}$${scryptOptions.r}$${scryptOptions.p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
	const [algorithm, nValue, rValue, pValue, saltHex, keyHex, extra] = encodedHash.split("$");
	if (
		algorithm !== "scrypt" ||
		nValue !== String(scryptOptions.N) ||
		rValue !== String(scryptOptions.r) ||
		pValue !== String(scryptOptions.p) ||
		!saltHex ||
		!keyHex ||
		extra !== undefined ||
		!/^[a-f0-9]{32}$/i.test(saltHex) ||
		!/^[a-f0-9]{128}$/i.test(keyHex)
	) return false;

	try {
		const expected = Buffer.from(keyHex, "hex");
		const actual = await derivePasswordKey(password, Buffer.from(saltHex, "hex"));
		return timingSafeEqual(actual, expected);
	} catch {
		return false;
	}
}

function removeExpiredSessions(now = Math.floor(Date.now() / 1000)): void {
	for (const [sessionId, expiresAt] of activeSessions) {
		if (expiresAt <= now) activeSessions.delete(sessionId);
	}
}

export async function authenticateAdmin(email: unknown, password: unknown): Promise<AdminIdentity | null> {
	const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
	const suppliedPassword = typeof password === "string" ? password : "";
	const account = await dataStore.findAdminByEmail(normalizedEmail);
	if (account) {
		return (await verifyPassword(suppliedPassword, account.passwordHash))
			? { email: account.email, role: "admin" }
			: null;
	}
	const emailMatches = safeEqual(normalizedEmail, config.adminEmail);
	const passwordMatches = safeEqual(suppliedPassword, config.adminPassword);
	if (emailMatches && passwordMatches) {
		return { email: config.adminEmail, role: "admin" };
	}
	return null;
}

export function createAdminToken(user: AdminIdentity): { token: string; expiresAt: number; user: AdminIdentity } {
	const now = Math.floor(Date.now() / 1000);
	const payload: TokenPayload = {
		...user,
		iat: now,
		exp: now + config.authTokenTtlSeconds,
		jti: randomUUID(),
	};
	const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
	const token = `${encodedPayload}.${sign(encodedPayload)}`;
	removeExpiredSessions(now);
	activeSessions.set(payload.jti, payload.exp);
	return {
		token,
		expiresAt: payload.exp,
		user,
	};
}

function verifyToken(token: string): TokenPayload | null {
	const [encodedPayload, suppliedSignature, extraPart] = token.split(".");
	if (!encodedPayload || !suppliedSignature || extraPart !== undefined) return null;
	if (!safeEqual(suppliedSignature, sign(encodedPayload))) return null;

	try {
		const parsed: unknown = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
		if (typeof parsed !== "object" || parsed === null) return null;
		const payload = parsed as Partial<TokenPayload>;
		const now = Math.floor(Date.now() / 1000);
		if (
			typeof payload.email !== "string" ||
			payload.role !== "admin" ||
			typeof payload.jti !== "string" ||
			typeof payload.exp !== "number" ||
			typeof payload.iat !== "number" ||
			payload.exp <= now ||
			!activeSessions.has(payload.jti)
		) return null;
		return payload as TokenPayload;
	} catch {
		return null;
	}
}

export function requireAdmin(request: Request, response: Response, next: NextFunction): void {
	const authorization = request.get("authorization");
	const match = authorization?.match(/^Bearer\s+(.+)$/i);
	const payload = match ? verifyToken(match[1] ?? "") : null;
	if (!payload) {
		response.status(401).json({ error: "Sesi admin tidak valid atau sudah berakhir." });
		return;
	}

	response.locals.admin = { email: payload.email, role: payload.role } satisfies AdminIdentity;
	response.locals.sessionId = payload.jti;
	removeExpiredSessions();
	next();
}

export function revokeAdminSession(sessionId: unknown): void {
	if (typeof sessionId === "string") activeSessions.delete(sessionId);
}
