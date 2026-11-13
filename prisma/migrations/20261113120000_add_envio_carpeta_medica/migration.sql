-- CreateTable
CREATE TABLE "envios_carpeta_medica" (
    "id" TEXT NOT NULL,
    "licenciaId" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "turno" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL,
    "diagnostico" TEXT NOT NULL,
    "doctor" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "reposo" TEXT NOT NULL,
    "certificadoPath" TEXT,
    "certificadoExpiraEn" TIMESTAMP(3),
    "enviadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envios_carpeta_medica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_app" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_app_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE INDEX "envios_carpeta_medica_licenciaId_idx" ON "envios_carpeta_medica"("licenciaId");

-- AddForeignKey
ALTER TABLE "envios_carpeta_medica" ADD CONSTRAINT "envios_carpeta_medica_licenciaId_fkey" FOREIGN KEY ("licenciaId") REFERENCES "licencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
