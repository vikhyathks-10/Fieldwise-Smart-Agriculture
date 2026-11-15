
-- Fieldwise authentication and farmer-update workflow migration.
-- Safe additive migration: creates only new tables and never drops/resets data.
-- Review names against information_schema before applying to an existing DB.

USE `smartagriculturedb`;

-- =========================================================
-- 1. ADMIN ACCOUNT
-- =========================================================

CREATE TABLE IF NOT EXISTS `admin_account` (
  `admin_id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('SUPER_ADMIN','ADMIN') NOT NULL DEFAULT 'ADMIN',
  `status` ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `uq_admin_account_email` (`email`),
  KEY `idx_admin_account_role_status` (`role`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- =========================================================
-- 2. FARMER ACCOUNT
-- =========================================================

CREATE TABLE IF NOT EXISTS `farmer_account` (
  `account_id` INT NOT NULL AUTO_INCREMENT,
  `farmer_id` INT NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `status` ENUM('PENDING','ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`account_id`),
  UNIQUE KEY `uq_farmer_account_farmer` (`farmer_id`),
  UNIQUE KEY `uq_farmer_account_email` (`email`),
  KEY `idx_farmer_account_status` (`status`),

  CONSTRAINT `fk_farmer_account_farmer`
    FOREIGN KEY (`farmer_id`)
    REFERENCES `farmer` (`Farmer_ID`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- =========================================================
-- 3. FARMER UPDATE
-- =========================================================

CREATE TABLE IF NOT EXISTS `farmer_update` (
  `update_id` BIGINT NOT NULL AUTO_INCREMENT,
  `account_id` INT NOT NULL,
  `farmer_id` INT NOT NULL,
  `farm_id` INT NOT NULL,
  `cultivation_id` INT DEFAULT NULL,
  `update_category` ENUM(
    'CULTIVATION_PROGRESS',
    'CROP_HEALTH',
    'PEST_DISEASE',
    'IRRIGATION',
    'SOIL_CONDITION',
    'YIELD_ESTIMATE',
    'GENERAL'
  ) NOT NULL,
  `observed_on` DATE DEFAULT NULL,
  `title` VARCHAR(160) NOT NULL,
  `description` TEXT NOT NULL,
  `crop_condition` VARCHAR(255) DEFAULT NULL,
  `progress_details` TEXT,
  `yield_estimate` DECIMAL(10,2) DEFAULT NULL,
  `target_field` ENUM(
    'CULTIVATION_STATUS',
    'CULTIVATION_REMARKS',
    'YIELD_ESTIMATE',
    'FARM_SOIL_TYPE'
  ) NOT NULL,
  `proposed_value` TEXT NOT NULL,
  `status` ENUM(
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CLARIFICATION_REQUESTED'
  ) NOT NULL DEFAULT 'PENDING',
  `submitted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`update_id`),
  KEY `idx_farmer_update_status_submitted` (`status`,`submitted_at`),
  KEY `idx_farmer_update_farmer_submitted` (`farmer_id`,`submitted_at`),
  KEY `idx_farmer_update_farm` (`farm_id`),
  KEY `idx_farmer_update_cultivation` (`cultivation_id`),

  CONSTRAINT `fk_farmer_update_account`
    FOREIGN KEY (`account_id`)
    REFERENCES `farmer_account` (`account_id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT `fk_farmer_update_farmer`
    FOREIGN KEY (`farmer_id`)
    REFERENCES `farmer` (`Farmer_ID`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT `fk_farmer_update_farm`
    FOREIGN KEY (`farm_id`)
    REFERENCES `farm` (`Farm_ID`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT `fk_farmer_update_cultivation`
    FOREIGN KEY (`cultivation_id`)
    REFERENCES `cultivation` (`Cultivation_ID`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- =========================================================
-- 4. UPDATE REVIEW
-- =========================================================

CREATE TABLE IF NOT EXISTS `update_review` (
  `review_id` BIGINT NOT NULL AUTO_INCREMENT,
  `update_id` BIGINT NOT NULL,
  `admin_id` INT DEFAULT NULL,
  `actor_type` ENUM('ADMIN','FARMER') NOT NULL,
  `decision` ENUM(
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'CLARIFICATION_REQUESTED',
    'CLARIFICATION_RESPONDED'
  ) NOT NULL,
  `review_comment` TEXT,
  `reviewed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`review_id`),
  KEY `idx_update_review_update_time` (`update_id`,`reviewed_at`),
  KEY `idx_update_review_admin` (`admin_id`),

  CONSTRAINT `fk_update_review_update`
    FOREIGN KEY (`update_id`)
    REFERENCES `farmer_update` (`update_id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  -- RESTRICT avoids the CHECK/FK conflict in MySQL 8.0.
  CONSTRAINT `fk_update_review_admin`
    FOREIGN KEY (`admin_id`)
    REFERENCES `admin_account` (`admin_id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT `chk_update_review_actor` CHECK (
    (`actor_type` = 'ADMIN' AND `admin_id` IS NOT NULL) OR
    (`actor_type` = 'FARMER' AND `admin_id` IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- =========================================================
-- 5. NOTIFICATION
-- =========================================================

CREATE TABLE IF NOT EXISTS `notification` (
  `notification_id` BIGINT NOT NULL AUTO_INCREMENT,
  `recipient_type` ENUM('ADMIN','FARMER') NOT NULL,
  `admin_id` INT DEFAULT NULL,
  `account_id` INT DEFAULT NULL,
  `title` VARCHAR(160) NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`notification_id`),
  KEY `idx_notification_admin` (`admin_id`,`is_read`,`created_at`),
  KEY `idx_notification_farmer` (`account_id`,`is_read`,`created_at`),

  CONSTRAINT `fk_notification_admin`
    FOREIGN KEY (`admin_id`)
    REFERENCES `admin_account` (`admin_id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT `fk_notification_farmer`
    FOREIGN KEY (`account_id`)
    REFERENCES `farmer_account` (`account_id`)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT `chk_notification_recipient` CHECK (
    (`recipient_type` = 'ADMIN' AND `admin_id` IS NOT NULL AND `account_id` IS NULL) OR
    (`recipient_type` = 'FARMER' AND `account_id` IS NOT NULL AND `admin_id` IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- =========================================================
-- END OF AUTHENTICATION AND FARMER PORTAL MIGRATION
-- =========================================================

-- Approval changes only one allowlisted field on the referenced
-- Farm or Cultivation row.
-- Pending/rejected updates never alter these base tables.
