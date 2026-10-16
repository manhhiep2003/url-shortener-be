/*
  Warnings:

  - The primary key for the `click_events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `clickedAt` on the `click_events` table. All the data in the column will be lost.
  - You are about to drop the column `countryCode` on the `click_events` table. All the data in the column will be lost.
  - You are about to drop the column `deviceType` on the `click_events` table. All the data in the column will be lost.
  - You are about to drop the column `referrerHost` on the `click_events` table. All the data in the column will be lost.
  - You are about to drop the column `shortLinkId` on the `click_events` table. All the data in the column will be lost.
  - The primary key for the `short_links` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `short_links` table. All the data in the column will be lost.
  - You are about to drop the column `destinationUrl` on the `short_links` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `short_links` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `short_links` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `short_links` table. All the data in the column will be lost.
  - You are about to alter the column `code` on the `short_links` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(64)`.
  - You are about to alter the column `title` on the `short_links` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `users` table. All the data in the column will be lost.
  - You are about to alter the column `email` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - Added the required column `short_link_id` to the `click_events` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `click_events` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `destination_url` to the `short_links` table without a default value. This is not possible if the table is not empty.
  - Added the required column `owner_id` to the `short_links` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `short_links` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `short_links` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `password_hash` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `users` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "click_events" DROP CONSTRAINT "click_events_shortLinkId_fkey";

-- DropForeignKey
ALTER TABLE "short_links" DROP CONSTRAINT "short_links_ownerId_fkey";

-- DropIndex
DROP INDEX "click_events_shortLinkId_clickedAt_idx";

-- DropIndex
DROP INDEX "short_links_ownerId_createdAt_idx";

-- DropIndex
DROP INDEX "short_links_ownerId_status_idx";

-- AlterTable
ALTER TABLE "click_events" DROP CONSTRAINT "click_events_pkey",
DROP COLUMN "clickedAt",
DROP COLUMN "countryCode",
DROP COLUMN "deviceType",
DROP COLUMN "referrerHost",
DROP COLUMN "shortLinkId",
ADD COLUMN     "clicked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "country_code" VARCHAR(2),
ADD COLUMN     "device_type" VARCHAR(32),
ADD COLUMN     "referrer_host" VARCHAR(255),
ADD COLUMN     "short_link_id" UUID NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "click_events_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "short_links" DROP CONSTRAINT "short_links_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "destinationUrl",
DROP COLUMN "expiresAt",
DROP COLUMN "ownerId",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "destination_url" TEXT NOT NULL,
ADD COLUMN     "expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "owner_id" UUID NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "code" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "title" SET DATA TYPE VARCHAR(255),
ADD CONSTRAINT "short_links_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "passwordHash",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "password_hash" VARCHAR(255) NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "click_events_short_link_id_clicked_at_idx" ON "click_events"("short_link_id", "clicked_at");

-- CreateIndex
CREATE INDEX "short_links_owner_id_created_at_idx" ON "short_links"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "short_links_owner_id_status_idx" ON "short_links"("owner_id", "status");

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_short_link_id_fkey" FOREIGN KEY ("short_link_id") REFERENCES "short_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
