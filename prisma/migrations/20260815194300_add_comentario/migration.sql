-- CreateTable
CREATE TABLE "comentarios" (
    "id" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "usuarioNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comentarios_agenteId_idx" ON "comentarios"("agenteId");

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "agentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
