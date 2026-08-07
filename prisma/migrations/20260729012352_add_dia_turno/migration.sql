-- CreateTable
CREATE TABLE "dias_turno" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "grupoTurno" INTEGER,
    "superiorTurnoId" TEXT,
    "jefeFinDeId" TEXT,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dias_turno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dias_turno_fecha_key" ON "dias_turno"("fecha");

-- AddForeignKey
ALTER TABLE "dias_turno" ADD CONSTRAINT "dias_turno_superiorTurnoId_fkey" FOREIGN KEY ("superiorTurnoId") REFERENCES "agentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dias_turno" ADD CONSTRAINT "dias_turno_jefeFinDeId_fkey" FOREIGN KEY ("jefeFinDeId") REFERENCES "agentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
