-- CreateTable
CREATE TABLE "eventos_curso_ascenso" (
    "id" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_curso_ascenso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventos_curso_ascenso_agenteId_idx" ON "eventos_curso_ascenso"("agenteId");

-- AddForeignKey
ALTER TABLE "eventos_curso_ascenso" ADD CONSTRAINT "eventos_curso_ascenso_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "agentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
