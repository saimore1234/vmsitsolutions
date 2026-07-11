-- AlterTable
ALTER TABLE "lead" ADD COLUMN     "country" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- CreateTable
CREATE TABLE "communication_settings" (
    "id" TEXT NOT NULL DEFAULT 'communication',
    "notifyEmail" TEXT NOT NULL DEFAULT 'sales@vmsitsolutions.com',
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappNumber" TEXT,
    "whatsappDefaultMessage" TEXT,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
    "databaseSaveEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoRedirectEnabled" BOOLEAN NOT NULL DEFAULT false,
    "thankYouPageEnabled" BOOLEAN NOT NULL DEFAULT false,
    "recaptchaSiteKey" TEXT,
    "recaptchaSecretKey" TEXT,
    "recaptchaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_settings_pkey" PRIMARY KEY ("id")
);

