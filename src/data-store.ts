import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
import type { Connection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { config } from "./config";

export interface DataRecord {
	id: string;
	createdAt: string;
	updatedAt: string;
	[key: string]: unknown;
}

export interface AdminAccount {
	id: string;
	name: string;
	email: string;
	passwordHash: string;
}

export interface PublicAdminAccount extends Omit<AdminAccount, "passwordHash"> {
	role: "admin";
}

interface StoredRow extends RowDataPacket {
	id: string;
	collection_name: string;
	payload: unknown;
	created_at: Date | string;
	updated_at: Date | string;
}

interface DomainStoredRow extends RowDataPacket {
	id: string;
	payload: unknown;
	created_at: Date | string;
	updated_at: Date | string;
}

type CollectionSchema = {
	columns: Record<string, string>;
};

// These collections back the catalog, inventory, account, community, map, and settings pages.
const collectionSchemas: Record<string, CollectionSchema> = {
	flowers: {
		columns: {
			name: "VARCHAR(255)", category: "VARCHAR(120)", price: "DECIMAL(14,2)",
			stock: "DECIMAL(12,3)", status: "VARCHAR(32)", description: "TEXT",
		},
	},
	birds: {
		columns: {
			name: "VARCHAR(255)", species: "VARCHAR(180)", category: "VARCHAR(120)",
			price: "DECIMAL(14,2)", stock: "DECIMAL(12,3)", status: "VARCHAR(32)", description: "TEXT",
		},
	},
	fish: {
		columns: {
			name: "VARCHAR(255)", species: "VARCHAR(180)", category: "VARCHAR(120)",
			price: "DECIMAL(14,2)", stock: "DECIMAL(12,3)", status: "VARCHAR(32)", description: "TEXT",
		},
	},
	pets: {
		columns: {
			name: "VARCHAR(255)", species: "VARCHAR(180)", category: "VARCHAR(120)",
			price: "DECIMAL(14,2)", stock: "DECIMAL(12,3)", status: "VARCHAR(32)", description: "TEXT",
		},
	},
	supplies: {
		columns: {
			name: "VARCHAR(255)", category: "VARCHAR(120)", price: "DECIMAL(14,2)",
			stock: "DECIMAL(12,3)", unit: "VARCHAR(80)", status: "VARCHAR(32)", description: "TEXT",
		},
	},
	inventory: {
		columns: {
			name: "VARCHAR(255)", sku: "VARCHAR(100)", category: "VARCHAR(120)",
			stock: "DECIMAL(12,3)", unit: "VARCHAR(80)", status: "VARCHAR(32)", description: "TEXT",
		},
	},
	users: {
		columns: {
			name: "VARCHAR(180)", email: "VARCHAR(254)", phone: "VARCHAR(40)",
			role: "VARCHAR(80)", status: "VARCHAR(32)", description: "TEXT",
		},
	},
	community_posts: {
		columns: {
			title: "VARCHAR(255)", author: "VARCHAR(180)", category: "VARCHAR(120)",
			content: "LONGTEXT", status: "VARCHAR(32)",
		},
	},
	market_locations: {
		columns: {
			name: "VARCHAR(255)", sector: "VARCHAR(120)", category: "VARCHAR(120)",
			latitude: "DECIMAL(10,7)", longitude: "DECIMAL(10,7)", description: "TEXT",
		},
	},
	admin_profiles: {
		columns: { name: "VARCHAR(120)", email: "VARCHAR(254)" },
	},
};

const pool = mysql.createPool({
	host: config.database.host,
	port: config.database.port,
	user: config.database.user,
	password: config.database.password,
	database: config.database.name,
	connectionLimit: config.database.connectionLimit,
	waitForConnections: true,
	queueLimit: 0,
	charset: "utf8mb4",
	timezone: "Z",
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function quoteIdentifier(identifier: string): string {
	if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
		throw new Error("Nama tabel atau kolom tidak valid.");
	}
	return `\`${identifier}\``;
}

function validateCollectionName(collection: string): void {
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(collection)) {
		throw new Error("Nama koleksi tidak valid.");
	}
}

function isoDate(value: Date | string): string {
	if (value instanceof Date) return value.toISOString();
	const parsed = new Date(`${value.replace(" ", "T")}Z`);
	if (Number.isNaN(parsed.getTime())) throw new Error("Timestamp database tidak valid.");
	return parsed.toISOString();
}

function parsePayload(value: unknown): Record<string, unknown> {
	const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
	if (!isPlainObject(parsed)) throw new Error("Payload database tidak valid.");
	return parsed;
}

function mapRecord(row: DomainStoredRow): DataRecord {
	return {
		...parsePayload(row.payload),
		id: row.id,
		createdAt: isoDate(row.created_at),
		updatedAt: isoDate(row.updated_at),
	};
}

function mapLegacyRow(row: StoredRow): DataRecord {
	return mapRecord(row);
}

function payloadForStorage(record: DataRecord): string {
	const payload: Record<string, unknown> = { ...record };
	delete payload.id;
	delete payload.createdAt;
	delete payload.updatedAt;
	return JSON.stringify(payload);
}

function collectionFields(collection: string): string[] {
	return Object.keys(collectionSchemas[collection]?.columns ?? {});
}

function collectionValues(collection: string, record: DataRecord): Array<string | number | null> {
	const columns = collectionSchemas[collection]?.columns ?? {};
	return Object.entries(columns).map(([field, sqlType]) => {
		const value = record[field];
		if (value === undefined || value === null || value === "") return null;
		if (/^(DECIMAL|INT|BIGINT|FLOAT|DOUBLE)/i.test(sqlType)) {
			const numericValue = typeof value === "number" ? value : Number(value);
			return Number.isFinite(numericValue) ? numericValue : null;
		}
		if (typeof value === "string") return value;
		if (["number", "boolean"].includes(typeof value)) return String(value);
		return null;
	});
}

async function ensureDatabaseExists(): Promise<void> {
	const { host, port, user, password, name } = config.database;
	if (!/^[A-Za-z0-9_]+$/.test(name)) {
		throw new Error("DB_NAME hanya boleh berisi huruf, angka, dan garis bawah.");
	}

	let probe: Connection | undefined;
	try {
		probe = await mysql.createConnection({ host, port, user, password, database: name });
		await probe.query("SELECT 1");
		await probe.end();
		return;
	} catch (error) {
		await probe?.end().catch(() => {});
		if ((error as { code?: string }).code !== "ER_BAD_DB_ERROR") throw error;
	}

	const bootstrap = await mysql.createConnection({ host, port, user, password });
	try {
		await bootstrap.query(
			`CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
		);
	} finally {
		await bootstrap.end();
	}
}

async function applySchema(): Promise<void> {
	const schemaPath = resolve(__dirname, "../database/schema.sql");
	const schema = await readFile(schemaPath, "utf8");
	for (const statement of schema.split(";").map((part) => part.trim()).filter(Boolean)) {
		await pool.query(statement);
	}
}

async function migrateLegacyCollections(): Promise<void> {
	for (const collection of Object.keys(collectionSchemas)) {
		const [rows] = await pool.execute<StoredRow[]>(
			`SELECT id, collection_name, payload, created_at, updated_at
			 FROM \`admin_records\` WHERE collection_name = ? ORDER BY created_at ASC, id ASC`,
			[collection],
		);
		const fields = collectionFields(collection);
		const columns = ["id", ...fields, "payload", "created_at", "updated_at"];
		const placeholders = columns.map(() => "?").join(", ");
		for (const row of rows) {
			const record = mapLegacyRow(row);
			await pool.execute(
				`INSERT IGNORE INTO ${quoteIdentifier(collection)} (${columns.map(quoteIdentifier).join(", ")})
				 VALUES (${placeholders})`,
				[
					row.id,
					...collectionValues(collection, record),
					payloadForStorage(record),
					row.created_at,
					row.updated_at,
				],
			);
		}
	}
}

export async function initializeDataStore(): Promise<void> {
	await ensureDatabaseExists();
	await applySchema();
	await pool.query("SELECT 1");
	await migrateLegacyCollections();
}

class MysqlDataStore {
	async findAdminByEmail(email: string): Promise<AdminAccount | null> {
		const [rows] = await pool.execute<RowDataPacket[]>(
			`SELECT id, name, email, password_hash
			 FROM \`admin_users\` WHERE email = ? LIMIT 1`,
			[email],
		);
		const row = rows[0] as (RowDataPacket & { id: string; name: string; email: string; password_hash: string }) | undefined;
		if (!row) return null;
		return { id: row.id, name: row.name, email: row.email, passwordHash: row.password_hash };
	}

	async createAdminAccount(
		name: string,
		email: string,
		passwordHash: string,
	): Promise<PublicAdminAccount | null> {
		if (email === config.adminEmail) return null;
		const id = randomUUID();
		const now = new Date();
		try {
			await pool.execute(
				`INSERT INTO \`admin_users\` (id, name, email, password_hash, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?)`,
				[id, name, email, passwordHash, now, now],
			);
		} catch (error) {
			if ((error as { code?: string }).code === "ER_DUP_ENTRY") return null;
			throw error;
		}
		return { id, name, email, role: "admin" };
	}

	async setAdminPassword(email: string, passwordHash: string): Promise<void> {
		const now = new Date();
		const id = randomUUID();
		const name = email.split("@")[0]?.slice(0, 120) || "Admin";
		await pool.execute<ResultSetHeader>(
			`INSERT INTO \`admin_users\` (id, name, email, password_hash, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), updated_at = VALUES(updated_at)`,
			[id, name, email, passwordHash, now, now],
		);
	}

	async list(collection: string): Promise<DataRecord[]> {
		validateCollectionName(collection);
		if (collectionSchemas[collection]) {
			const [rows] = await pool.execute<DomainStoredRow[]>(
				`SELECT id, payload, created_at, updated_at
				 FROM ${quoteIdentifier(collection)} ORDER BY created_at ASC, id ASC`,
			);
			return rows.map(mapRecord);
		}
		const [rows] = await pool.execute<StoredRow[]>(
			`SELECT id, collection_name, payload, created_at, updated_at
			 FROM \`admin_records\` WHERE collection_name = ? ORDER BY created_at ASC, id ASC`,
			[collection],
		);
		return rows.map(mapLegacyRow);
	}

	async get(collection: string, id: string): Promise<DataRecord | null> {
		validateCollectionName(collection);
		if (collectionSchemas[collection]) {
			const [rows] = await pool.execute<DomainStoredRow[]>(
				`SELECT id, payload, created_at, updated_at
				 FROM ${quoteIdentifier(collection)} WHERE id = ? LIMIT 1`,
				[id],
			);
			return rows[0] ? mapRecord(rows[0]) : null;
		}
		const [rows] = await pool.execute<StoredRow[]>(
			`SELECT id, collection_name, payload, created_at, updated_at
			 FROM \`admin_records\` WHERE collection_name = ? AND id = ? LIMIT 1`,
			[collection, id],
		);
		return rows[0] ? mapLegacyRow(rows[0]) : null;
	}

	async create(collection: string, input: Record<string, unknown>): Promise<DataRecord> {
		validateCollectionName(collection);
		const id = randomUUID();
		const now = new Date();
		const record: DataRecord = {
			...input,
			id,
			createdAt: now.toISOString(),
			updatedAt: now.toISOString(),
		};

		if (collectionSchemas[collection]) {
			const fields = collectionFields(collection);
			const columns = ["id", ...fields, "payload", "created_at", "updated_at"];
			await pool.execute(
				`INSERT INTO ${quoteIdentifier(collection)} (${columns.map(quoteIdentifier).join(", ")})
				 VALUES (${columns.map(() => "?").join(", ")})`,
				[id, ...collectionValues(collection, record), payloadForStorage(record), now, now],
			);
			return record;
		}

		await pool.execute(
			`INSERT INTO \`admin_records\` (id, collection_name, payload, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`,
			[id, collection, payloadForStorage(record), now, now],
		);
		return record;
	}

	async update(
		collection: string,
		id: string,
		input: Record<string, unknown>,
		replace = false,
	): Promise<DataRecord | null> {
		validateCollectionName(collection);
		const connection = await pool.getConnection();
		try {
			await connection.beginTransaction();
			const domain = Boolean(collectionSchemas[collection]);
			const [rows] = domain
				? await connection.execute<DomainStoredRow[]>(
						`SELECT id, payload, created_at, updated_at
						 FROM ${quoteIdentifier(collection)} WHERE id = ? LIMIT 1 FOR UPDATE`,
						[id],
					)
				: await connection.execute<StoredRow[]>(
						`SELECT id, collection_name, payload, created_at, updated_at
						 FROM \`admin_records\` WHERE collection_name = ? AND id = ? LIMIT 1 FOR UPDATE`,
						[collection, id],
					);
			const previousRow = rows[0] as DomainStoredRow | undefined;
			if (!previousRow) {
				await connection.rollback();
				return null;
			}

			const previous = mapRecord(previousRow);
			const userFields = { ...input };
			delete userFields.id;
			delete userFields.createdAt;
			delete userFields.updatedAt;
			const now = new Date();
			const updated: DataRecord = {
				...(replace ? {} : previous),
				...userFields,
				id: previous.id,
				createdAt: previous.createdAt,
				updatedAt: now.toISOString(),
			};

			if (domain) {
				const fields = collectionFields(collection);
				const assignments = fields.map((field) => `${quoteIdentifier(field)} = ?`);
				await connection.execute(
					`UPDATE ${quoteIdentifier(collection)} SET ${[...assignments, "payload = ?", "updated_at = ?"].join(", ")}
					 WHERE id = ?`,
					[...collectionValues(collection, updated), payloadForStorage(updated), now, id],
				);
			} else {
				await connection.execute(
					`UPDATE \`admin_records\` SET payload = ?, updated_at = ?
					 WHERE collection_name = ? AND id = ?`,
					[payloadForStorage(updated), now, collection, id],
				);
			}
			await connection.commit();
			return updated;
		} catch (error) {
			await connection.rollback();
			throw error;
		} finally {
			connection.release();
		}
	}

	async remove(collection: string, id: string): Promise<DataRecord | null> {
		validateCollectionName(collection);
		const connection = await pool.getConnection();
		try {
			await connection.beginTransaction();
			const domain = Boolean(collectionSchemas[collection]);
			const [rows] = domain
				? await connection.execute<DomainStoredRow[]>(
						`SELECT id, payload, created_at, updated_at
						 FROM ${quoteIdentifier(collection)} WHERE id = ? LIMIT 1 FOR UPDATE`,
						[id],
					)
				: await connection.execute<StoredRow[]>(
						`SELECT id, collection_name, payload, created_at, updated_at
						 FROM \`admin_records\` WHERE collection_name = ? AND id = ? LIMIT 1 FOR UPDATE`,
						[collection, id],
					);
			const row = rows[0] as DomainStoredRow | undefined;
			const record = row ? mapRecord(row) : null;
			if (!record) {
				await connection.rollback();
				return null;
			}

			if (domain) {
				await connection.execute(`DELETE FROM ${quoteIdentifier(collection)} WHERE id = ?`, [id]);
			} else {
				await connection.execute(
					`DELETE FROM \`admin_records\` WHERE collection_name = ? AND id = ?`,
					[collection, id],
				);
			}
			await connection.commit();
			return record;
		} catch (error) {
			await connection.rollback();
			throw error;
		} finally {
			connection.release();
		}
	}
}

export const dataStore = new MysqlDataStore();

export function parseRecordInput(value: unknown): Record<string, unknown> | null {
	return isPlainObject(value) ? value : null;
}

export async function closeDataStore(): Promise<void> {
	await pool.end();
}
