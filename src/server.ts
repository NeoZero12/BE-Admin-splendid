import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { config } from "./config";
import { closeDataStore, initializeDataStore } from "./data-store";
import { apiRouter } from "./routes";

const app = express();
app.disable("x-powered-by");

app.use(cors({
	origin(origin, callback) {
		if (!origin || config.corsOrigins.includes(origin)) {
			callback(null, true);
			return;
		}
		callback(null, false);
	},
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "2mb" }));
app.use("/api", apiRouter);

app.use((_request, response) => {
	response.status(404).json({ error: "Endpoint tidak ditemukan." });
});

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
	const bodyError = error as { type?: string; status?: number };
	if (bodyError.type === "entity.parse.failed") {
		response.status(400).json({ error: "Body JSON tidak valid." });
		return;
	}
	if (bodyError.type === "entity.too.large") {
		response.status(413).json({ error: "Ukuran body melebihi batas 2 MB." });
		return;
	}
	if (error instanceof Error && error.message === "Nama koleksi tidak valid.") {
		response.status(400).json({ error: error.message });
		return;
	}
	console.error(error);
	response.status(500).json({ error: "Terjadi kesalahan pada server." });
};
app.use(errorHandler);

async function startServer(): Promise<void> {
	await initializeDataStore();
	const server = app.listen(config.port, () => {
		console.log(`Splendid Admin API berjalan di http://localhost:${config.port}/api`);
		console.log(`Database aktif: ${config.database.name}`);
	});

	const shutdown = () => {
		server.close(() => {
			void closeDataStore();
		});
	};
	process.once("SIGINT", shutdown);
	process.once("SIGTERM", shutdown);
}

void startServer().catch((error: unknown) => {
	console.error("Gagal menghubungkan backend ke database:", error);
	process.exitCode = 1;
	void closeDataStore();
});
