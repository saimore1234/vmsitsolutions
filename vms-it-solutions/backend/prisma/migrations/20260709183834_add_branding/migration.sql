-- AlterTable
ALTER TABLE "logos" ADD COLUMN     "thumbUrl" TEXT;

-- CreateTable
CREATE TABLE "logo_history" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logo_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logo_settings" (
    "id" TEXT NOT NULL DEFAULT 'logo',
    "width" INTEGER NOT NULL DEFAULT 160,
    "height" INTEGER NOT NULL DEFAULT 40,
    "position" TEXT NOT NULL DEFAULT 'left',
    "padding" INTEGER NOT NULL DEFAULT 8,
    "background" TEXT,
    "borderRadius" INTEGER NOT NULL DEFAULT 0,
    "headerLogoHeight" INTEGER NOT NULL DEFAULT 40,
    "footerLogoHeight" INTEGER NOT NULL DEFAULT 32,
    "mobileLogoHeight" INTEGER NOT NULL DEFAULT 32,
    "stickyHeaderLogo" BOOLEAN NOT NULL DEFAULT true,
    "darkModeLogoEnabled" BOOLEAN NOT NULL DEFAULT true,
    "retinaLogo" BOOLEAN NOT NULL DEFAULT true,
    "enableSvgLogo" BOOLEAN NOT NULL DEFAULT true,
    "maxUploadSizeMb" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logo_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "logo_history_kind_createdAt_idx" ON "logo_history"("kind", "createdAt");
