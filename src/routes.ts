import { Router, type Request, type Response } from "express";
import {
	authenticateAdmin,
	createAdminToken,
	hashPassword,
	requireAdmin,
	revokeAdminSession,
} from "./auth";
import { dataStore, parseRecordInput } from "./data-store";

export const apiRouter = Router();

function pathParameter(value: string | string[] | undefined): string {
	return typeof value === "string" ? value : "";
}

apiRouter.get("/health", (_request, response) => {
	response.json({ status: "ok", service: "splendid-admin-api" });
});

apiRouter.post("/auth/login", async (request, response) => {
	const body = parseRecordInput(request.body);
	if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
		response.status(400).json({ error: "Email dan password wajib diisi." });
		return;
	}
	const admin = await authenticateAdmin(body.email, body.password);
	if (!admin) {
		response.status(401).json({ error: "Email atau password salah." });
		return;
	}
	response.json(createAdminToken(admin));
});

apiRouter.post("/auth/register", requireAdmin, async (request, response) => {
	const body = parseRecordInput(request.body);
	if (
		!body ||
		typeof body.name !== "string" ||
		typeof body.email !== "string" ||
		typeof body.password !== "string"
	) {
		response.status(400).json({ error: "Nama, email, dan password wajib diisi." });
		return;
	}

	const name = body.name.trim();
	const email = body.email.trim().toLowerCase();
	const password = body.password;
	if (name.length < 2 || name.length > 120) {
		response.status(400).json({ error: "Nama harus berisi 2 sampai 120 karakter." });
		return;
	}
	if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		response.status(400).json({ error: "Format email tidak valid." });
		return;
	}
	if (password.length < 12 || password.length > 128) {
		response.status(400).json({ error: "Password harus berisi 12 sampai 128 karakter." });
		return;
	}

	const passwordHash = await hashPassword(password);
	const user = await dataStore.createAdminAccount(name, email, passwordHash);
	if (!user) {
		response.status(409).json({ error: "Email sudah terdaftar." });
		return;
	}
	response.status(201).json({ user });
});

apiRouter.get("/auth/me", requireAdmin, (_request, response) => {
	response.json({ user: response.locals.admin });
});

apiRouter.post("/auth/logout", requireAdmin, (_request, response) => {
	revokeAdminSession(response.locals.sessionId);
	response.status(204).end();
});

apiRouter.post("/auth/change-password", requireAdmin, async (request, response) => {
	const body = parseRecordInput(request.body);
	if (
		!body ||
		typeof body.currentPassword !== "string" ||
		typeof body.newPassword !== "string"
	) {
		response.status(400).json({ error: "Kata sandi saat ini dan kata sandi baru wajib diisi." });
		return;
	}
	if (body.newPassword.length < 12 || body.newPassword.length > 128) {
		response.status(400).json({ error: "Kata sandi baru harus berisi 12 sampai 128 karakter." });
		return;
	}
	if (body.currentPassword === body.newPassword) {
		response.status(400).json({ error: "Kata sandi baru harus berbeda dari kata sandi saat ini." });
		return;
	}

	const email = response.locals.admin.email as string;
	if (!(await authenticateAdmin(email, body.currentPassword))) {
		response.status(401).json({ error: "Kata sandi saat ini tidak sesuai." });
		return;
	}
	await dataStore.setAdminPassword(email, await hashPassword(body.newPassword));
	response.status(204).end();
});

apiRouter.use("/data", requireAdmin);

apiRouter.get("/data/:collection", async (request: Request, response: Response) => {
	const records = await dataStore.list(pathParameter(request.params.collection));
	response.json({ data: records });
});

apiRouter.post("/data/:collection", async (request: Request, response: Response) => {
	const input = parseRecordInput(request.body);
	if (!input) {
		response.status(400).json({ error: "Body harus berupa objek JSON." });
		return;
	}
	const record = await dataStore.create(pathParameter(request.params.collection), input);
	response.status(201).json({ data: record });
});

apiRouter.get("/data/:collection/:id", async (request: Request, response: Response) => {
	const record = await dataStore.get(
		pathParameter(request.params.collection),
		pathParameter(request.params.id),
	);
	if (!record) {
		response.status(404).json({ error: "Data tidak ditemukan." });
		return;
	}
	response.json({ data: record });
});

apiRouter.patch("/data/:collection/:id", async (request: Request, response: Response) => {
	const input = parseRecordInput(request.body);
	if (!input) {
		response.status(400).json({ error: "Body harus berupa objek JSON." });
		return;
	}
	const record = await dataStore.update(
		pathParameter(request.params.collection),
		pathParameter(request.params.id),
		input,
	);
	if (!record) {
		response.status(404).json({ error: "Data tidak ditemukan." });
		return;
	}
	response.json({ data: record });
});

apiRouter.put("/data/:collection/:id", async (request: Request, response: Response) => {
	const input = parseRecordInput(request.body);
	if (!input) {
		response.status(400).json({ error: "Body harus berupa objek JSON." });
		return;
	}
	const record = await dataStore.update(
		pathParameter(request.params.collection),
		pathParameter(request.params.id),
		input,
		true,
	);
	if (!record) {
		response.status(404).json({ error: "Data tidak ditemukan." });
		return;
	}
	response.json({ data: record });
});

apiRouter.delete("/data/:collection/:id", async (request: Request, response: Response) => {
	const record = await dataStore.remove(
		pathParameter(request.params.collection),
		pathParameter(request.params.id),
	);
	if (!record) {
		response.status(404).json({ error: "Data tidak ditemukan." });
		return;
	}
	response.json({ data: record });
});
