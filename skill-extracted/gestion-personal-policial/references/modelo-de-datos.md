# Modelo de Datos — Esquema Prisma

Esquema de base de datos para el sistema de gestión de personal policial.
Usar como referencia al crear o modificar el archivo `prisma/schema.prisma`.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = env("DATABASE_PROVIDER") // "sqlite" en dev | "postgresql" en prod
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─── ENUMS ────────────────────────────────────────────────────────────────────

enum TipoPersonal {
  SEGURIDAD       // Personal policial con rango formal y armamento
  TECNICO         // Agente técnico especializado
  CIVIL_BECARIO   // Personal civil en condición de becario
  CIVIL_POLICIAL  // Personal civil de planta policial
}

enum EstadoAgente {
  ACTIVO
  BAJA
  SUSPENDIDO
  LICENCIA_EXTENDIDA
}

enum RolUsuario {
  SUPERADMIN
  ADMIN
  SUPERVISOR
  OPERADOR
  READONLY
}

enum EstadoLicencia {
  PENDIENTE
  APROBADA
  RECHAZADA
  CANCELADA
}

enum TipoLicencia {
  ORDINARIA        // Vacaciones anuales
  MEDICA           // Por enfermedad/salud
  ESPECIAL         // Maternidad, duelo, etc.
  SIN_GOCE_SUELDO
}

enum TipoFranco {
  ORDINARIO        // Franco semanal habitual
  COMPENSATORIO    // Por horas extra trabajadas
  ESPECIAL
}

enum EstadoAsistencia {
  PRESENTE
  AUSENTE_JUSTIFICADO
  AUSENTE_INJUSTIFICADO
  FRANCO
  LICENCIA
  FERIADO
}

enum TipoSector {
  DIRECCION
  DEPARTAMENTO
  DIVISION
}

enum TipoExcepcionTurno {
  HORA_EXTRA
  CAMBIO_TURNO
  GUARDIA_ESPECIAL
}

// ─── MODELOS ──────────────────────────────────────────────────────────────────

// Escalafón completo — 3 cuerpos: Suboficial, Oficial, Técnico
// Los civiles (CIVIL_BECARIO, CIVIL_POLICIAL) NO tienen jerarquía
//
// SUBOFICIAL (orden 1–8):
//   1. Agente
//   2. Cabo
//   3. Cabo Primero
//   4. Sargento
//   5. Sargento Primero
//   6. Sargento Ayudante
//   7. Suboficial Principal
//   8. Suboficial Mayor
//
// OFICIAL (orden 9–18):
//   9.  Oficial Ayudante
//   10. Oficial Subinspector
//   11. Oficial Inspector
//   12. Oficial Principal
//   13. Subcomisario
//   14. Comisario
//   15. Comisario Inspector
//   16. Comisario Mayor
//   17. Comisario General
//   18. Jefe
//
// TÉCNICO (orden 19–26):
//   19. Agente Técnico
//   20. Cabo Técnico
//   21. Cabo Primero Técnico
//   22. Sargento Técnico
//   23. Sargento Primero Técnico
//   24. Sargento Ayudante Técnico
//   25. Principal Técnico
//   26. Mayor Técnico
model Rango {
  id          String   @id @default(cuid())
  nombre      String   @unique
  cuerpo      String   // "SUBOFICIAL" | "OFICIAL" | "TECNICO"
  orden       Int      // Para ordenar jerárquicamente dentro y entre cuerpos
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  agentes     Agente[]

  @@map("rangos")
}

// Estructura organizacional de la Dirección Monitoreo Cordobeses en Alerta
// Seed inicial:
//   - Dirección Monitoreo Cordobeses en Alerta (DIRECCION, padre: null)
//   - División Ayudantía Dir. Monitoreo Cordobeses en Alerta (DIVISION, padre: Dirección)
//   - Departamento Alerta Ciudadana (DEPARTAMENTO, padre: Dirección)
//   - División Coordinación Vecinal (DIVISION, padre: Depto. Alerta Ciudadana)
//   - División Alerta (DIVISION, padre: Depto. Alerta Ciudadana)
//   - Departamento Socio Educativo (DEPARTAMENTO, padre: Dirección)
model Sector {
  id        String     @id @default(cuid())
  nombre    String     @unique
  tipo      TipoSector
  padreId   String?
  padre     Sector?    @relation("SectorJerarquia", fields: [padreId], references: [id])
  hijos     Sector[]   @relation("SectorJerarquia")
  agentes   Agente[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@map("sectores")
}

model Agente {
  id             String       @id @default(cuid())
  cuil           String       @unique
  // Datos personales
  nombres        String
  apellidos      String
  sexo           String       // "MASCULINO" | "FEMENINO"
  fechaNacimiento DateTime?
  estadoCivil    String?      // "SOLTERO" | "CASADO" | "EN UNIÓN LIBRE"
  nacionalidad   String?
  provinciaOrigen String?
  ciudadOrigen   String?
  grupoSanguineo String?
  alergias       String?
  enfermedadesCronicas String?
  medicamentos   String?
  cirugias       String?
  hijosCargo     Int          @default(0)
  poseeSepelio   Boolean      @default(false)
  empresaSepelio String?      // Nombre de la empresa de sepelio

  // Contacto
  email          String?      @unique
  telefono       String?
  telefonoAlternativo String?
  contactoEmergencia String?  // "NOMBRE - RELACIÓN"

  // Domicilio
  domicilioReal  String?
  ciudad         String?
  barrio         String?
  nroDomicilio   String?
  piso           String?

  // Datos laborales
  tipoPersonal   TipoPersonal
  estado         EstadoAgente @default(ACTIVO)
  fechaIngreso   DateTime?
  turno          String?
  // Turnos reales: "A", "B", "C", "D", "E", "F",
  // "ADMINISTRATIVO", "FULL TIME", "GUARDIA LARGA", "SUPERIOR DE TURNO"

  // Solo para SEGURIDAD
  rangoId        String?
  rango          Rango?       @relation(fields: [rangoId], references: [id])
  anoEgreso      DateTime?    // Año de egreso de la fuerza
  perteneceETAC  Boolean?     // Perteneció al E.T.A.C.
  tipoArma       String?      // "PISTOLA" | "SIN ARMAMENTO"
  marcaPistola   String?
  modeloPistola  String?
  calibre        String?
  chalecoProvisto Boolean?
  marcaChaleco   String?
  nroSeriePlacas String?
  talleChaleco   String?
  vencimientoChaleco DateTime?

  // Licencia de conducir
  licenciaConducir String?    // Categoría, ej: "B.1", "D.4"
  licenciaEmision  DateTime?
  licenciaVencimiento DateTime?

  // Nivel académico
  nivelPrimario  String?      // "COMPLETADO" | null
  nivelSecundario String?
  nivelTerciario String?
  nivelUniversitario String?
  nivelSuperior  String?
  detalleTitulos String?      // Descripción libre de títulos y estudios

  // Foto
  fotoUrl        String?      // URL de Google Drive o storage

  // Sector organizacional
  sectorId       String?
  sector         Sector?      @relation(fields: [sectorId], references: [id])

  // Relaciones
  usuarioId      String?      @unique
  usuario        Usuario?     @relation(fields: [usuarioId], references: [id])
  asistencias    Asistencia[]
  licencias      Licencia[]
  francos        Franco[]
  turnoAsignado  TurnoAgente?
  excepciones    ExcepcionTurno[]
  historialRangos HistorialRango[]

  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@map("agentes")
}

model HistorialRango {
  id         String   @id @default(cuid())
  agenteId   String
  agente     Agente   @relation(fields: [agenteId], references: [id])
  rangoId    String
  rango      Rango    @relation(fields: [rangoId], references: [id])
  fechaDesde DateTime
  fechaHasta DateTime? // null = rango actual
  observacion String?
  createdAt  DateTime @default(now())

  @@map("historial_rangos")
}

model Usuario {
  id        String     @id @default(cuid()) // Debe coincidir con Supabase Auth UID
  email     String     @unique
  rol       RolUsuario @default(READONLY)
  activo    Boolean    @default(true)
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  agente    Agente?

  @@map("usuarios")
}

// Seed inicial de turnos:
// | nombre          | horaInicio | horaFin | diasTrabajo | diasDescanso |
// |-----------------|------------|---------|-------------|--------------|
// | A               | 07:00      | 15:00   | 2           | 2            |
// | B               | 07:00      | 15:00   | 2           | 2            |
// | C               | 15:00      | 23:00   | 2           | 2            |
// | D               | 15:00      | 23:00   | 2           | 2            |
// | E               | 23:00      | 07:00   | 2           | 2            |
// | F               | 23:00      | 07:00   | 2           | 2            |
// | GUARDIA LARGA   | 10:00      | 22:00   | 1           | 2            |
// | ADMINISTRATIVO  | null       | null    | 0           | 0            |
// | FULL TIME       | null       | null    | 0           | 0            |
// | SUPERIOR TURNO  | null       | null    | 0           | 0            |
model Turno {
  id            String   @id @default(cuid())
  nombre        String   @unique
  horaInicio    String?  // "07:00" — null para turnos sin franja fija
  horaFin       String?  // "15:00" — null para turnos sin franja fija
  diasTrabajo   Int      @default(1) // 2 para A-F, 1 para GUARDIA LARGA
  diasDescanso  Int      @default(0) // 2 para A-F y GUARDIA LARGA, 0 para el resto
  descripcion   String?
  createdAt     DateTime @default(now())

  // Ciclos:
  // Turnos A-F:      2 días trabajo + 2 días descanso (ciclo continuo)
  // Guardia Larga:   1 día trabajo  + 2 días descanso
  // Administrativo, Full Time, Superior de Turno: sin ciclo definido

  asignaciones  TurnoAgente[]

  @@map("turnos")
}

model TurnoAgente {
  id         String   @id @default(cuid())
  agenteId   String   @unique // Un agente tiene un turno fijo
  agente     Agente   @relation(fields: [agenteId], references: [id])
  turnoId    String
  turno      Turno    @relation(fields: [turnoId], references: [id])
  fechaDesde DateTime
  createdAt  DateTime @default(now())

  @@map("turnos_agentes")
}

model ExcepcionTurno {
  id          String             @id @default(cuid())
  agenteId    String
  agente      Agente             @relation(fields: [agenteId], references: [id])
  tipo        TipoExcepcionTurno
  fecha       DateTime
  horaInicio  String?
  horaFin     String?
  descripcion String?
  aprobadoPor String?            // ID del usuario que aprobó
  createdAt   DateTime           @default(now())

  @@map("excepciones_turno")
}

model Asistencia {
  id        String           @id @default(cuid())
  agenteId  String
  agente    Agente           @relation(fields: [agenteId], references: [id])
  fecha     DateTime         @db.Date
  estado    EstadoAsistencia
  horaEntrada DateTime?
  horaSalida  DateTime?
  observacion String?
  registradoPor String?      // ID del usuario que cargó
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  @@unique([agenteId, fecha]) // Un registro por agente por día
  @@map("asistencias")
}

model Licencia {
  id           String         @id @default(cuid())
  agenteId     String
  agente       Agente         @relation(fields: [agenteId], references: [id])
  tipo         TipoLicencia
  estado       EstadoLicencia @default(PENDIENTE)
  fechaInicio  DateTime       @db.Date
  fechaFin     DateTime       @db.Date
  diasHabiles  Int
  motivo       String?
  observacion  String?        // Nota del aprobador
  aprobadoPor  String?        // ID del usuario que aprobó/rechazó
  aprobadoEn   DateTime?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  @@map("licencias")
}

model Franco {
  id          String     @id @default(cuid())
  agenteId    String
  agente      Agente     @relation(fields: [agenteId], references: [id])
  tipo        TipoFranco
  fecha       DateTime   @db.Date
  descripcion String?
  createdAt   DateTime   @default(now())

  @@map("francos")
}
```

---

## Notas sobre Supabase + Prisma

- La `DATABASE_URL` usa el **connection pooler** de Supabase (puerto 6543)
- La `DIRECT_URL` usa la conexión directa (puerto 5432) — necesaria para migraciones Prisma
- Configurar **Row Level Security (RLS)** en Supabase para cada tabla
- El `id` de `Usuario` debe coincidir con el UID de Supabase Auth para facilitar el RLS
- Usar `prisma migrate dev` en desarrollo y `prisma migrate deploy` en producción

## Variables de entorno necesarias

### Desarrollo (`.env`)
```env
DATABASE_PROVIDER="sqlite"
DATABASE_URL="file:./dev.db"
# DIRECT_URL no es necesaria en desarrollo
REDIS_URL="redis://localhost:6379"

# Supabase Auth se puede mockear en dev o apuntar a un proyecto de staging
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
```

### Producción (`.env.production`)
```env
DATABASE_PROVIDER="postgresql"
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
REDIS_URL="redis://..."  # URL del proveedor Redis en producción
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
```

### Desarrollo (adicional — Brevo)
```env
BREVO_API_KEY="..."
BREVO_FROM_EMAIL="noreply@[dominio].com"
BREVO_FROM_NAME="Sistema de Personal Policial"
```
> En desarrollo, **no enviar mails reales** — loguear el código de 6 dígitos en consola.
