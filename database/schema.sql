CREATE TABLE IF NOT EXISTS `admin_records` (
	id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	collection_name VARCHAR(64) NOT NULL,
	payload JSON NOT NULL,
	created_at DATETIME(3) NOT NULL,
	updated_at DATETIME(3) NOT NULL,
	PRIMARY KEY (id),
	KEY idx_admin_records_collection_created (collection_name, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_users` (
	id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	name VARCHAR(120) NOT NULL,
	email VARCHAR(254) NOT NULL,
	password_hash VARCHAR(255) NOT NULL,
	created_at DATETIME(3) NOT NULL,
	updated_at DATETIME(3) NOT NULL,
	PRIMARY KEY (id),
	UNIQUE KEY uq_admin_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `flowers` (
	id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	name VARCHAR(255) NULL,
	category VARCHAR(120) NULL,
	price DECIMAL(14,2) NULL,
	stock DECIMAL(12,3) NULL,
	status VARCHAR(32) NULL,
	description TEXT NULL,
	payload JSON NOT NULL,
	created_at DATETIME(3) NOT NULL,
	updated_at DATETIME(3) NOT NULL,
	PRIMARY KEY (id),
	KEY idx_flowers_category (category),
	KEY idx_flowers_status (status),
	KEY idx_flowers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `birds` (
	id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	name VARCHAR(255) NULL,
	species VARCHAR(180) NULL,
	category VARCHAR(120) NULL,
	price DECIMAL(14,2) NULL,
	stock DECIMAL(12,3) NULL,
	status VARCHAR(32) NULL,
	description TEXT NULL,
	payload JSON NOT NULL,
	created_at DATETIME(3) NOT NULL,
	updated_at DATETIME(3) NOT NULL,
	PRIMARY KEY (id),
	KEY idx_birds_category (category),
	KEY idx_birds_status (status),
	KEY idx_birds_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fish` (
	id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	name VARCHAR(255) NULL,
	species VARCHAR(180) NULL,
	category VARCHAR(120) NULL,
	price DECIMAL(14,2) NULL,
	stock DECIMAL(12,3) NULL,
	status VARCHAR(32) NULL,
	description TEXT NULL,
	payload JSON NOT NULL,
	created_at DATETIME(3) NOT NULL,
	updated_at DATETIME(3) NOT NULL,
	PRIMARY KEY (id),
	KEY idx_fish_category (category),
	KEY idx_fish_status (status),
	KEY idx_fish_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pets` (
	id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	name VARCHAR(255) NULL,
	species VARCHAR(180) NULL,
	category VARCHAR(120) NULL,
	price DECIMAL(14,2) NULL,
	stock DECIMAL(12,3) NULL,
	status VARCHAR(32) NULL,
	description TEXT NULL,
	payload JSON NOT NULL,
	created_at DATETIME(3) NOT NULL,
	updated_at DATETIME(3) NOT NULL,
	PRIMARY KEY (id),
	KEY idx_pets_category (category),
	KEY idx_pets_status (status),
	KEY idx_pets_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supplies` (
	id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	name VARCHAR(255) NULL,
	category VARCHAR(120) NULL,
	price DECIMAL(14,2) NULL,
	stock DECIMAL(12,3) NULL,
	unit VARCHAR(80) NULL,
	status VARCHAR(32) NULL,
	description TEXT NULL,
	payload JSON NOT NULL,
	created_at DATETIME(3) NOT NULL,
	updated_at DATETIME(3) NOT NULL,
	PRIMARY KEY (id),
	KEY idx_supplies_category (category),
	KEY idx_supplies_status (status),
	KEY idx_supplies_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory` (
	id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	name VARCHAR(255) NULL,
	sku VARCHAR(100) NULL,
	category VARCHAR(120) NULL,
	stock DECIMAL(12,3) NULL,
	unit VARCHAR(80) NULL,
	status VARCHAR(32) NULL,
	description TEXT NULL,
	payload JSON NOT NULL,
	created_at DATETIME(3) NOT NULL,
	updated_at DATETIME(3) NOT NULL,
	PRIMARY KEY (id),
	KEY idx_inventory_sku (sku),
	KEY idx_inventory_category (category),
	KEY idx_inventory_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
	id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	name VARCHAR(180) NULL,
	email VARCHAR(254) NULL,
	phone VARCHAR(40) NULL,
	role VARCHAR(80) NULL,
	status VARCHAR(32) NULL,
	description TEXT NULL,
	payload JSON NOT NULL,
	created_at DATETIME(3) NOT NULL,
	updated_at DATETIME(3) NOT NULL,
	PRIMARY KEY (id),
	KEY idx_users_email (email),
	KEY idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `community_posts` (
	id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	title VARCHAR(255) NULL,
	author VARCHAR(180) NULL,
	category VARCHAR(120) NULL,
	content LONGTEXT NULL,
	status VARCHAR(32) NULL,
	payload JSON NOT NULL,
	created_at DATETIME(3) NOT NULL,
	updated_at DATETIME(3) NOT NULL,
	PRIMARY KEY (id),
	KEY idx_community_posts_category (category),
	KEY idx_community_posts_status (status),
	KEY idx_community_posts_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `market_locations` (
	id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	name VARCHAR(255) NULL,
	sector VARCHAR(120) NULL,
	category VARCHAR(120) NULL,
	latitude DECIMAL(10,7) NULL,
	longitude DECIMAL(10,7) NULL,
	description TEXT NULL,
	payload JSON NOT NULL,
	created_at DATETIME(3) NOT NULL,
	updated_at DATETIME(3) NOT NULL,
	PRIMARY KEY (id),
	KEY idx_market_locations_sector (sector),
	KEY idx_market_locations_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_profiles` (
	id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	name VARCHAR(120) NULL,
	email VARCHAR(254) NULL,
	payload JSON NOT NULL,
	created_at DATETIME(3) NOT NULL,
	updated_at DATETIME(3) NOT NULL,
	PRIMARY KEY (id),
	UNIQUE KEY uq_admin_profiles_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
