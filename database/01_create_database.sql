-- Creates the configured database only when it does not already exist.
-- This script never drops or resets an existing database.
CREATE DATABASE IF NOT EXISTS `smartagriculturedb`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE `smartagriculturedb`;
