-- CreateTable
CREATE TABLE "roles_organigrama" (
    "id" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "agenteId" TEXT,
    "rangoLibre" TEXT,
    "nombreLibre" TEXT,
    "licencia" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_organigrama_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_organigrama_sectorId_orden_key" ON "roles_organigrama"("sectorId", "orden");

-- AddForeignKey
ALTER TABLE "roles_organigrama" ADD CONSTRAINT "roles_organigrama_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_organigrama" ADD CONSTRAINT "roles_organigrama_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "agentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
