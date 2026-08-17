-- CreateTable
CREATE TABLE "coberturas_turno" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "agenteId" TEXT,
    "nombreManual" TEXT,
    "lugar" TEXT NOT NULL,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coberturas_turno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coberturas_turno_tipo_anio_mes_idx" ON "coberturas_turno"("tipo", "anio", "mes");

-- AddForeignKey
ALTER TABLE "coberturas_turno" ADD CONSTRAINT "coberturas_turno_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "agentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
