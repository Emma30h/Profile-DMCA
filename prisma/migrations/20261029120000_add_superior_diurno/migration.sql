-- AlterTable
ALTER TABLE "dias_turno" ADD COLUMN     "superiorDiurnoId" TEXT,
ADD COLUMN     "superiorDiurnoManual" TEXT;

-- AddForeignKey
ALTER TABLE "dias_turno" ADD CONSTRAINT "dias_turno_superiorDiurnoId_fkey" FOREIGN KEY ("superiorDiurnoId") REFERENCES "agentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
