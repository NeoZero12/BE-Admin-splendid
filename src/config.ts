import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalEnv(): void {
	const envPath = resolve(process.cwd(), ".env");
	if (!existsSync(envPath)) return;

	for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		const separator = line.indexOf("=");
		if (separator < 1) continue;

		const key = line.slice(0, separator).trim();
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;

		let value = line.slice(separator + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		} else {
			value = value.replace(/\s+#.*$/, "").trim();
		}
		process.env[key] = value;
	}
}

function requiredEnv(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(
			`Missing required environment variable: ${name}. Set it in backend .env (copy .env.example first) or in the process environment.`,
		);
	}
	return value;
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
	if (!value) return fallback;
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 1) {
		throw new Error(`${name} must be a positive integer`);
	}
	return parsed;
}

loadLocalEnv();

const authTokenSecret = requiredEnv("AUTH_TOKEN_SECRET");
if (authTokenSecret.length < 32 || authTokenSecret.includes("replace-with-a-random-secret")) {
	throw new Error("AUTH_TOKEN_SECRET must contain at least 32 characters");
}

const adminPassword = requiredEnv("ADMIN_PASSWORD");
if (adminPassword.length < 12 || adminPassword === "change-this-password") {
	throw new Error("ADMIN_PASSWORD must be changed and contain at least 12 characters");
}

const port = positiveInteger(process.env.PORT, 4000, "PORT");
const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000,http://127.0.0.1:3000")
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

export const config = {
	port,
	adminEmail: requiredEnv("ADMIN_EMAIL").toLowerCase(),
	adminPassword,
	authTokenSecret,
	database: {
		host: process.env.DB_HOST?.trim() || "127.0.0.1",
		port: positiveInteger(process.env.DB_PORT, 3306, "DB_PORT"),
		user: process.env.DB_USER?.trim() || "root",
		password: process.env.DB_PASSWORD ?? "",
		name: process.env.DB_NAME?.trim() || "admin_splendid",
		connectionLimit: positiveInteger(process.env.DB_CONNECTION_LIMIT, 10, "DB_CONNECTION_LIMIT"),
	},
	authTokenTtlSeconds: positiveInteger(
		process.env.AUTH_TOKEN_TTL_SECONDS,
		8 * 60 * 60,
		"AUTH_TOKEN_TTL_SECONDS",
	),
	corsOrigins,
};
