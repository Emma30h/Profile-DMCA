-- CreateTable
CREATE TABLE "confirmaciones_eliminar_usuario" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "objetivoId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "intentosPassword" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "confirmaciones_eliminar_usuario_pkey" PRIMARY KEY ("id")
);
