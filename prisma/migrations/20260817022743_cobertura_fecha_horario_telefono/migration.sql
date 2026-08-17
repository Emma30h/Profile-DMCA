/*
  Warnings:

  - You are about to drop the column `anio` on the `coberturas_turno` table. All the data in the column will be lost.
  - You are about to drop the column `mes` on the `coberturas_turno` table. All the data in the column will be lost.
  - Added the required column `fecha` to the `coberturas_turno` table without a default value. This is not possible if the table is not empty.
  - Added the required column `horarioDesde` to the `coberturas_turno` table without a default value. This is not possible if the table is not empty.
  - Added the required column `horarioHasta` to the `coberturas_turno` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "coberturas_turno_tipo_anio_mes_idx";

-- AlterTable
ALTER TABLE "coberturas_turno" DROP COLUMN "anio",
DROP COLUMN "mes",
ADD COLUMN     "fecha" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "horarioDesde" TEXT NOT NULL,
ADD COLUMN     "horarioHasta" TEXT NOT NULL,
ADD COLUMN     "telefono" TEXT;

-- CreateIndex
CREATE INDEX "coberturas_turno_tipo_fecha_idx" ON "coberturas_turno"("tipo", "fecha");
