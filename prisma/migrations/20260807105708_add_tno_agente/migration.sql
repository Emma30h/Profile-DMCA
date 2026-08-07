-- AlterTable
ALTER TABLE "agentes" ADD COLUMN     "enTNO" BOOLEAN DEFAULT false,
ADD COLUMN     "fechaInicioTNO" TIMESTAMP(3),
ADD COLUMN     "motivoTNO" TEXT;
