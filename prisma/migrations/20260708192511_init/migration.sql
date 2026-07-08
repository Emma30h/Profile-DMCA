-- CreateTable
CREATE TABLE "rangos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rangos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sectores" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "padreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sectores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agentes" (
    "id" TEXT NOT NULL,
    "cuil" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "sexo" TEXT NOT NULL,
    "sexoPersonalizado" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "estadoCivil" TEXT,
    "nacionalidad" TEXT,
    "provinciaOrigen" TEXT,
    "ciudadOrigen" TEXT,
    "grupoSanguineo" TEXT,
    "alergias" TEXT,
    "enfermedadesCronicas" TEXT,
    "medicamentos" TEXT,
    "cirugias" TEXT,
    "hijosCargo" INTEGER NOT NULL DEFAULT 0,
    "poseeSepelio" BOOLEAN NOT NULL DEFAULT false,
    "empresaSepelio" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "telefonoAlternativo" TEXT,
    "contactoEmergencia" TEXT,
    "telefonoContactoEmergencia" TEXT,
    "domicilioReal" TEXT,
    "ciudad" TEXT,
    "barrio" TEXT,
    "nroDomicilio" TEXT,
    "piso" TEXT,
    "tipoPersonal" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "motivoRechazo" TEXT,
    "fechaIngreso" TIMESTAMP(3),
    "turno" TEXT,
    "rangoId" TEXT,
    "anoEgreso" TIMESTAMP(3),
    "perteneceETAC" BOOLEAN,
    "tipoArma" TEXT,
    "marcaPistola" TEXT,
    "modeloPistola" TEXT,
    "calibre" TEXT,
    "chalecoProvisto" BOOLEAN,
    "marcaChaleco" TEXT,
    "nroSeriePlacas" TEXT,
    "talleChaleco" TEXT,
    "vencimientoChaleco" TIMESTAMP(3),
    "licenciaConducir" TEXT,
    "licenciaEmision" TIMESTAMP(3),
    "licenciaVencimiento" TIMESTAMP(3),
    "nivelPrimario" TEXT,
    "nivelSecundario" TEXT,
    "nivelTerciario" TEXT,
    "nivelUniversitario" TEXT,
    "nivelSuperior" TEXT,
    "detalleTitulos" TEXT,
    "fotoUrl" TEXT,
    "sectorId" TEXT,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_estados" (
    "id" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "estadoAnterior" TEXT NOT NULL,
    "estadoNuevo" TEXT NOT NULL,
    "motivo" TEXT,
    "usuarioNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_estados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_rangos" (
    "id" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "rangoId" TEXT NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3),
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_rangos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'READONLY',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "nombre" TEXT,
    "apellido" TEXT,
    "tipoPersonal" TEXT,
    "jerarquia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "diasTrabajo" INTEGER NOT NULL DEFAULT 1,
    "diasDescanso" INTEGER NOT NULL DEFAULT 0,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos_agentes" (
    "id" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turnos_agentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excepciones_turno" (
    "id" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "descripcion" TEXT,
    "aprobadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excepciones_turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistencias" (
    "id" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL,
    "horaEntrada" TIMESTAMP(3),
    "horaSalida" TIMESTAMP(3),
    "observacion" TEXT,
    "registradoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asistencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licencias" (
    "id" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "diasHabiles" INTEGER NOT NULL,
    "motivo" TEXT,
    "observacion" TEXT,
    "aprobadoPor" TEXT,
    "aprobadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licencias_pendientes" (
    "id" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tipoOtroDetalle" TEXT,
    "unidad" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "cantidadDias" INTEGER NOT NULL,
    "referencia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licencias_pendientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usos_licencia_pendiente" (
    "id" TEXT NOT NULL,
    "licenciaPendienteId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "cantidadDias" INTEGER NOT NULL,
    "referencia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usos_licencia_pendiente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_edicion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "motivoRechazo" TEXT,
    "permisoHasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_edicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "referenciaId" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feriados" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nombre" TEXT NOT NULL,
    "aplica" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feriados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reset_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "usuarioNombre" TEXT,
    "seccion" TEXT NOT NULL,
    "cambios" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rangos_nombre_key" ON "rangos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "sectores_nombre_key" ON "sectores"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "agentes_cuil_key" ON "agentes"("cuil");

-- CreateIndex
CREATE UNIQUE INDEX "agentes_email_key" ON "agentes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "agentes_usuarioId_key" ON "agentes"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "turnos_nombre_key" ON "turnos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "turnos_agentes_agenteId_key" ON "turnos_agentes"("agenteId");

-- CreateIndex
CREATE UNIQUE INDEX "asistencias_agenteId_fecha_key" ON "asistencias"("agenteId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "feriados_fecha_key" ON "feriados"("fecha");

-- AddForeignKey
ALTER TABLE "sectores" ADD CONSTRAINT "sectores_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "sectores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentes" ADD CONSTRAINT "agentes_rangoId_fkey" FOREIGN KEY ("rangoId") REFERENCES "rangos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentes" ADD CONSTRAINT "agentes_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentes" ADD CONSTRAINT "agentes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_estados" ADD CONSTRAINT "historial_estados_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "agentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_rangos" ADD CONSTRAINT "historial_rangos_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "agentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_rangos" ADD CONSTRAINT "historial_rangos_rangoId_fkey" FOREIGN KEY ("rangoId") REFERENCES "rangos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_agentes" ADD CONSTRAINT "turnos_agentes_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "agentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_agentes" ADD CONSTRAINT "turnos_agentes_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excepciones_turno" ADD CONSTRAINT "excepciones_turno_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "agentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "agentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencias" ADD CONSTRAINT "licencias_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "agentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencias_pendientes" ADD CONSTRAINT "licencias_pendientes_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "agentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usos_licencia_pendiente" ADD CONSTRAINT "usos_licencia_pendiente_licenciaPendienteId_fkey" FOREIGN KEY ("licenciaPendienteId") REFERENCES "licencias_pendientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_edicion" ADD CONSTRAINT "solicitudes_edicion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

