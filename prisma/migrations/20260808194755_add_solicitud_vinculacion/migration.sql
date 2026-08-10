-- CreateTable
CREATE TABLE "solicitudes_vinculacion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "criterio" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "motivoRechazo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisadoEn" TIMESTAMP(3),

    CONSTRAINT "solicitudes_vinculacion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "solicitudes_vinculacion" ADD CONSTRAINT "solicitudes_vinculacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_vinculacion" ADD CONSTRAINT "solicitudes_vinculacion_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "agentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
