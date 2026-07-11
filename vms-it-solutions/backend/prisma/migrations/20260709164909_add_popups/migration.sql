-- CreateTable
CREATE TABLE "popups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'announcement',
    "title" TEXT,
    "content" TEXT,
    "imageUrl" TEXT,
    "ctaText" TEXT,
    "ctaUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trigger" TEXT NOT NULL DEFAULT 'delay',
    "delaySeconds" INTEGER NOT NULL DEFAULT 5,
    "scrollPercent" INTEGER NOT NULL DEFAULT 50,
    "frequency" TEXT NOT NULL DEFAULT 'session',
    "pageRules" JSONB,
    "deviceRules" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "dismissals" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "popups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "popups_isActive_startAt_endAt_idx" ON "popups"("isActive", "startAt", "endAt");
