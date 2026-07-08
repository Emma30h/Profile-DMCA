---
name: gestion-personal-policial
description: >
  Skill para el desarrollo de una aplicación web de gestión de personal de la Dirección Monitoreo Cordobeses en Alerta,
  perteneciente a la Policía de Córdoba (Argentina). Usar este skill siempre que el usuario mencione: Cordobeses en Alerta,
  Dirección Monitoreo, personal policial, agentes, legajos, turnos, guardias, francos, licencias, escalafón, rangos,
  asistencia, presentismo, login, dashboard, listado de personal, o cualquier funcionalidad relacionada con la
  administración de recursos humanos en un contexto de seguridad pública. También activar cuando el usuario haga
  preguntas sobre el modelo de datos, las entidades de la app, los roles de usuario, las fases de desarrollo,
  o el stack tecnológico del proyecto (Next.js, Prisma, Supabase, Redis, SQLite, TypeScript).
---

# Skill: Gestión de Personal Policial

## Contexto del Proyecto

Aplicación web para administrar el personal de la **Dirección Monitoreo Cordobeses en Alerta**, perteneciente a la Policía de Córdoba, Argentina.
El sistema debe gestionar cuatro tipos de personal (campo `TipoPersonal`):
- **SEGURIDAD**: Agentes policiales con rango/jerarquía formal y armamento asignado
- **TECNICO**: Agentes técnicos especializados (ej: Técnico Electrónico)
- **CIVIL_BECARIO**: Personal civil en condición de becario
- **CIVIL_POLICIAL**: Personal civil de planta policial

Los turnos y sus horarios son:

| Turno | Horario | Tipo |
|---|---|---|
| A | 07:00 – 15:00 | Franja mañana |
| B | 07:00 – 15:00 | Franja mañana |
| C | 15:00 – 23:00 | Franja tarde |
| D | 15:00 – 23:00 | Franja tarde |
| E | 23:00 – 07:00 | Franja noche |
| F | 23:00 – 07:00 | Franja noche |
| GUARDIA LARGA | 10:00 – 22:00 (12hs) + 2 días de descanso | Guardia especial |
| ADMINISTRATIVO | Horario administrativo | Sin franja fija |
| FULL TIME | Jornada completa | Sin franja fija |
| SUPERIOR DE TURNO | Variable | Rol de conducción |

> A y B comparten franja pero son grupos distintos de personas. Lo mismo C/D y E/F.
>
> **Ciclo de turnos A–F**: 2 días trabajados + 2 días de descanso (ciclo continuo).
> **Guardia Larga**: 1 día trabajado (10:00–22:00) + 2 días de descanso.

La app está en **etapa de planificación/inicio** — no hay código existente aún.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend + Backend | **Next.js** (App Router) |
| Lenguaje | **TypeScript** (estricto, `strict: true`) |
| ORM | **Prisma** |
| Base de datos (desarrollo) | **SQLite** |
| Base de datos (producción) / Auth | **Supabase** (PostgreSQL + Auth) |
| Caché | **Redis** |

### Uso de Redis
Redis se usa exclusivamente para **caché de consultas frecuentes**:
- Listados de agentes (con filtros)
- Reportes de asistencia y presentismo
- Datos de rangos y turnos (cambian poco)
- TTL recomendado: 5 minutos para datos operativos, 1 hora para datos de configuración
- Usar el paquete `ioredis` para la conexión
- Patrón de clave: `{entidad}:{identificador}:{parametros_hash}` — ej: `agentes:lista:abc123`
- Invalidar caché al realizar mutaciones sobre la entidad correspondiente

### Configuración de base de datos por entorno
Prisma usa el provider según el entorno mediante la variable `DATABASE_PROVIDER`:

```prisma
// prisma/schema.prisma
datasource db {
  provider = env("DATABASE_PROVIDER") // "sqlite" en dev, "postgresql" en prod
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")       // solo necesario en producción
}
```

> ⚠️ **Importante**: SQLite no soporta todas las features de PostgreSQL. Evitar usar en el esquema Prisma: `@db.Date`, `@db.Text`, tipos de enum nativos. Usar tipos compatibles con ambos providers. Los enums de Prisma funcionan en ambos (se mapean a `TEXT` en SQLite).

### Convenciones a seguir
- Usar **App Router** de Next.js (no Pages Router)
- **Server Actions** para mutaciones de datos
- **Server Components** por defecto; Client Components solo cuando sea necesario
- Autenticación con **Supabase Auth** (no NextAuth) — en desarrollo se puede mockear o usar un usuario fijo
- Esquema de base de datos gestionado con **Prisma** conectado a Supabase en prod
- Nombrado de archivos: `kebab-case` para archivos, `PascalCase` para componentes
- Todo el código en **TypeScript estricto** — no usar `any`, tipar todas las funciones

---

## Dominio y Entidades Principales

Leer `references/modelo-de-datos.md` para el esquema Prisma detallado.

### Resumen de entidades

- **`Agente`** — Persona que trabaja en el área. Tiene tipo de personal, rango/grado (si aplica) y estado. Contiene datos personales, laborales, médicos, académicos y de armamento según el tipo.
- **`Rango`** — Jerarquía policial formal. Solo aplica a personal de tipo `SEGURIDAD` y `TECNICO`. Los civiles NO tienen jerarquía. El escalafón tiene 3 cuerpos con 26 rangos en total — ver detalle en `references/modelo-de-datos.md`.
- **`Turno`** — Horario de trabajo asignado. El sistema usa **horario fijo con excepciones** (no turnos rotativos puros).
- **`Asistencia`** — Registro diario de presencia: presente, ausente, con licencia, franco, etc.
- **`Licencia`** — Solicitud de licencia (ordinaria, médica, especial). Tiene estado: pendiente, aprobada, rechazada.
- **`Franco`** — Día de descanso asignado o compensatorio.
- **`Usuario`** — Quien accede al sistema. Distinto del Agente (puede haber usuarios admin que no son agentes).

---

## Roles de Usuario

El sistema tiene múltiples roles con distintos permisos:

| Rol | Descripción | Permisos clave |
|---|---|---|
| `SUPERADMIN` | Administrador total del sistema | Todo |
| `ADMIN` | Jefe de área / responsable de RRHH | Gestión completa del personal |
| `SUPERVISOR` | Jefe de turno o superior intermedio | Ver y aprobar licencias, gestionar turnos de su grupo |
| `OPERADOR` | Carga datos, registra asistencia | Carga de asistencia, sin borrar ni aprobar |
| `READONLY` | Solo lectura (auditoría, consulta) | Solo visualización |

---

## Fases de Desarrollo

### ✅ FASE 1 — En curso (arranque del proyecto)

La Fase 1 cubre tres funcionalidades base que deben construirse primero:

#### 1. Login
- Ruta: `/login` (pública)
- Autenticación con **Supabase Auth**
- El `Usuario` autenticado se sincroniza con la tabla `usuarios` en Prisma para obtener su `rol`
- Al autenticarse exitosamente → redirigir a `/dashboard`
- Manejar errores: credenciales inválidas, usuario inactivo, cuenta no verificada

**Métodos de autenticación:**
- Email + contraseña
- **Google OAuth** (login con cuenta de Google vía Supabase Auth)
  - Configurar proveedor Google en el dashboard de Supabase
  - Al autenticarse por primera vez con Google, crear el registro en la tabla `usuarios` automáticamente con rol `READONLY`

**Verificación de cuenta por email (código de 6 dígitos):**
- Al crear un nuevo usuario, se envía un mail con un **código de 6 dígitos** para verificar la cuenta
- El usuario debe ingresar ese código en una pantalla de verificación antes de poder acceder
- Ruta: `/verificar-cuenta`
- El mismo flujo aplica para **cambio de contraseña**: se envía un código al mail del usuario para confirmar la operación
- Ruta: `/cambiar-contrasena`
- Los códigos tienen expiración de **15 minutos**
- El envío de mails se realiza con **Brevo** (antes Sendinblue) mediante su API transaccional
- En desarrollo, loguear el código en consola en lugar de enviar el mail real

**Sesión y cookies:**
- La sesión dura **24 horas**
- Usar **cookies HTTP-only** para almacenar el token de sesión de Supabase (no localStorage)
- Usar `@supabase/ssr` para manejar cookies correctamente en Next.js App Router
- El middleware de Next.js verifica la cookie en cada request y refresca el token si está por vencer
- Al cerrar sesión, eliminar la cookie y revocar el token en Supabase

**Variables de entorno adicionales para Brevo:**
```env
BREVO_API_KEY="..."
BREVO_FROM_EMAIL="noreply@[dominio].com"
BREVO_FROM_NAME="Sistema de Personal Policial"
```

#### 2. Dashboard — Información general del personal
- Ruta: `/dashboard` (ruta raíz protegida tras login)
- Tarjetas de resumen con conteos del personal:
  - Total de agentes activos
  - Desglose por tipo: Seguridad / Técnico / Civil
  - Agentes en estado BAJA o SUSPENDIDO
- Datos obtenidos desde la tabla `Agente` vía Prisma
- Usar caché Redis con TTL de 5 minutos para estas consultas
- Diseño limpio tipo panel administrativo, responsive pero optimizado para desktop

#### 3. Listado de Personal
- Ruta: `/personal`
- Tabla con **todos los agentes** del área
- Columnas mínimas: Legajo | Apellido y Nombre | Tipo | Rango (si aplica) | Estado
- Filtros: por tipo de personal, por estado (activo/baja/etc.)
- Búsqueda por nombre, apellido o número de legajo
- Paginación del lado del servidor
- Al hacer click en un agente → navegar al detalle del legajo (puede ser placeholder `/personal/[id]` en Fase 1)
- Usar caché Redis para el listado

#### Estructura de rutas — Fase 1
```
/login                  → Página de login: email+pass y Google OAuth (pública)
/verificar-cuenta       → Ingreso del código de 6 dígitos para verificar cuenta (pública)
/cambiar-contrasena     → Flujo de cambio de contraseña con código por mail (pública)
/dashboard              → Dashboard con resumen del personal (protegida)
/personal               → Listado de todo el personal (protegida)
/personal/[id]          → Detalle del agente — placeholder en Fase 1
```

#### Middleware de protección
Implementar middleware de Next.js (`middleware.ts`) que:
- Verifica sesión de Supabase en cada request
- Redirige a `/login` si no hay sesión activa
- Redirige al `/dashboard` si un usuario autenticado intenta acceder a `/login`

#### Modelos Prisma necesarios en Fase 1
Solo se necesitan estas entidades para la Fase 1:
- `Usuario` — para autenticación y roles
- `Agente` — para dashboard y listado
- `Rango` — para mostrar en el listado

---

### 🔲 FASE 2 — Planificada (próxima)
- Legajos completos (alta, edición, baja de agentes)
- Escalafón y gestión de rangos

### 🔲 FASE 3 — Planificada
- Turnos y horarios

### 🔲 FASE 4 — Planificada
- Asistencia y presentismo

### 🔲 FASE 5 — Planificada
- Licencias y francos

---

## Funcionalidades del Sistema (completo)

Ver `references/funcionalidades.md` para descripción detallada de cada módulo.

### Módulos principales
1. **Legajos** — Alta, baja y modificación de agentes. Datos personales, laborales y jerárquicos.
2. **Turnos y Horarios** — Asignación de horario fijo. Registro de excepciones (horas extra, cambio de turno).
3. **Asistencia y Presentismo** — Registro diario. Reportes de ausentismo.
4. **Licencias y Francos** — Solicitud, aprobación y seguimiento de licencias. Gestión de francos.
5. **Escalafón y Jerarquía** — Estructura de rangos. Historial de ascensos.

---


---


---

## Estructura Organizacional

La Dirección se organiza de la siguiente manera (extraído del organigrama oficial):

```
Dirección Monitoreo Cordobeses en Alerta
├── División Ayudantía Dir. Monitoreo Cordobeses en Alerta
├── Departamento Alerta Ciudadana
│   ├── División Coordinación Vecinal
│   └── División Alerta
└── Departamento Socio Educativo
```

Cada agente pertenece a uno de estos sectores. El modelo `Sector` representa esta estructura con soporte para jerarquía (un sector puede tener un sector padre).

### Tipos de nodo
- **Dirección** — nivel raíz
- **Departamento** — depende de la Dirección
- **División** — depende de un Departamento o directamente de la Dirección

---

## Campos por Tipo de Personal

No todos los campos del legajo aplican a todos los tipos. Esta tabla define qué se completa según el tipo:

| Campo | SEGURIDAD | TECNICO | CIVIL_BECARIO | CIVIL_POLICIAL |
|---|:---:|:---:|:---:|:---:|
| **Datos personales** (nombre, CUIL, DNI, sexo, nacimiento, estado civil, nacionalidad, origen) | ✅ | ✅ | ✅ | ✅ |
| **Contacto** (email, teléfonos, contacto de emergencia) | ✅ | ✅ | ✅ | ✅ |
| **Domicilio** | ✅ | ✅ | ✅ | ✅ |
| **Datos médicos** (grupo sanguíneo, alergias, enfermedades, medicamentos, cirugías) | ✅ | ✅ | ✅ | ✅ |
| **Nivel académico y títulos** | ✅ | ✅ | ✅ | ✅ |
| **Licencia de conducir** | ✅ | ✅ | ✅ | ✅ |
| **Servicio de sepelio** | ✅ | ✅ | ✅ | ✅ |
| **Hijos a cargo** | ✅ | ✅ | ✅ | ✅ |
| **Foto** | ✅ | ✅ | ✅ | ✅ |
| **Turno** | ✅ | ✅ | ✅ | ✅ |
| **Fecha de ingreso** | ✅ | ✅ | ✅ | ✅ |
| **Jerarquía / Rango** | ✅ | ✅ | ❌ | ❌ |
| **Año de egreso** | ✅ | ✅ | ❌ | ❌ |
| **Perteneció al E.T.A.C.** | ✅ | ✅ | ❌ | ❌ |
| **Armamento** (tipo de arma, marca, modelo, calibre) | ✅ | ❌ | ❌ | ❌ |
| **Chaleco** (marca, serie, talle, vencimiento) | ✅ | ❌ | ❌ | ❌ |

> En los formularios y vistas de legajo, los campos que no aplican al tipo de personal seleccionado deben **ocultarse**, no solo deshabilitarse.

---
## Migración de Datos Existentes

El área ya cuenta con **172 registros de personal** en un Google Form exportado a Excel (`DB__D_M_C_A.xlsx`).
Estos datos deben migrarse a la base de datos como parte del arranque del proyecto.

### Estado de los datos
- **172 registros totales**, 169 con datos completos (3 filas vacías al final)
- **CUILs únicos**: sin duplicados — es un identificador confiable
- **Emails únicos**: sin duplicados — aptos para autenticación
- Completitud general muy alta (~98% en campos clave)
- **Jerarquía**: solo el 23% tiene dato, pero el 100% del personal SEGURIDAD sí lo tiene (correcto, los otros tipos no tienen rango)

### Distribución real del personal
| Tipo | Cantidad |
|---|---|
| CIVIL_BECARIO | 128 |
| TECNICO | 27 |
| SEGURIDAD | 12 |
| CIVIL_POLICIAL | 2 |
| **Total** | **169** |

### Distribución por turno
A: 28 · B: 16 · C: 28 · D: 27 · E: 27 · F: 26 · ADMINISTRATIVO: 6 · GUARDIA LARGA: 6 · FULL TIME: 3 · SUPERIOR DE TURNO: 2

### Fotos del personal
- 166 registros tienen foto como **URL de Google Drive**
- 1 registro tiene solo nombre de archivo local
- 5 registros sin foto
- En la migración, conservar las URLs de Drive tal cual en el campo `fotoUrl`

### Script de migración
Crear un script en `prisma/seed.ts` que:
1. Lee el archivo Excel con `xlsx` o `exceljs`
2. Limpia y transforma los datos (normalizar strings, parsear fechas, mapear tipos)
3. Crea los registros de `Rango` si no existen (seed inicial)
4. Inserta cada agente con `prisma.agente.upsert()` usando el CUIL como clave única
5. Loguea los registros omitidos o con errores

### Mapeo de campos Excel → Prisma
| Columna Excel | Campo Prisma | Transformación |
|---|---|---|
| CUIL | `cuil` | Convertir a string, quitar decimales |
| NOMBRE/S | `nombres` | Trim |
| APELLIDO/S | `apellidos` | Trim, uppercase |
| SEXO | `sexo` | Mantener |
| FECHA DE NACIMIENTO | `fechaNacimiento` | DateTime |
| ESTADO CIVIL | `estadoCivil` | Mantener |
| NACIONALIDAD | `nacionalidad` | Mantener |
| PROVINCIA DE ORIGEN | `provinciaOrigen` | Mantener |
| CIUDAD DE ORIGEN | `ciudadOrigen` | Mantener |
| TELEFONO | `telefono` | Convertir a string |
| TELEFONO ALTERNATIVO | `telefonoAlternativo` | Convertir a string |
| A QUIEN PERTENECE... | `contactoEmergencia` | Mantener |
| DOMICILIO REAL | `domicilioReal` | Mantener |
| CIUDAD | `ciudad` | Mantener |
| BARRIO | `barrio` | Mantener |
| NRO. DE DOMICILIO | `nroDomicilio` | Convertir a string |
| PISO | `piso` | Convertir a string |
| HIJOS A CARGO | `hijosCargo` | Int |
| POSEE SERVICIO DE SEPELIO | `poseeSepelio` | "Sí" → true |
| Nombre de la empresa | `empresaSepelio` | Mantener |
| TURNO | `turno` | Mantener |
| FECHA DE INGRESO | `fechaIngreso` | DateTime |
| TIPO DE PERSONAL | `tipoPersonal` | Mapear: "CIVIL BECARIO"→CIVIL_BECARIO, "CIVIL POLICIAL"→CIVIL_POLICIAL |
| TIPO DE ARMA | `tipoArma` | Mantener |
| MARCA DE PISTOLA | `marcaPistola` | Mantener |
| MODELO DE PISTOLA | `modeloPistola` | Mantener |
| CALIBRE | `calibre` | Mantener |
| CHALECO PROVISTO | `chalecoProvisto` | "Sí"/"Si" → true |
| MARCA | `marcaChaleco` | Mantener |
| N° DE SERIE (PLACAS) | `nroSeriePlacas` | Convertir a string |
| TALLE | `talleChaleco` | Mantener |
| VENCIMIENTO | `vencimientoChaleco` | DateTime |
| JERARQUIA | `rangoId` | Buscar Rango por nombre, solo si SEGURIDAD |
| AÑO DE EGRESO | `anoEgreso` | DateTime |
| PERTENECIÓ AL E.T.A.C? | `perteneceETAC` | "SI"→true, "NO"→false |
| GRUPO SANGUINEO | `grupoSanguineo` | Mantener |
| ALERGIAS | `alergias` | Mantener |
| ENFERMEDADES CRONICAS | `enfermedadesCronicas` | Mantener |
| MEDICAMENTOS... | `medicamentos` | Mantener |
| CIRUJIAS | `cirugias` | Mantener |
| NIVEL ACADEMICO [PRIMARIO] | `nivelPrimario` | Mantener |
| NIVEL ACADEMICO [SECUNDARIA] | `nivelSecundario` | Mantener |
| NIVEL ACADEMICO [TERCIARIO] | `nivelTerciario` | Mantener |
| NIVEL ACADEMICO [UNIVERISTARIO] | `nivelUniversitario` | Mantener |
| NIVEL ACADEMICO [SUPERIOR] | `nivelSuperior` | Mantener |
| DETALLE DE TITULO O ESTUDIOS | `detalleTitulos` | Mantener |
| LICENCIA DE CONDUCIR | `licenciaConducir` | Mantener |
| FECHA DE EMISION | `licenciaEmision` | DateTime |
| FECHA DE VENCIMIENTO | `licenciaVencimiento` | DateTime |
| Dirección de correo electrónico | `email` | Trim, lowercase |
| FOTO | `fotoUrl` | Mantener URL de Drive tal cual |

### Correcciones manuales conocidas
Errores detectados en el Excel que deben corregirse durante la migración:

| CUIL / Nombre | Campo | Valor en Excel | Valor correcto |
|---|---|---|---|
| Suarez, Agustina | `tipoPersonal` | `CIVIL POLICIAL` | `CIVIL_BECARIO` |

### Ejecutar migración
```bash
# Colocar el Excel en prisma/data/DB__D_M_C_A.xlsx
npx ts-node prisma/seed.ts
# o con tsx:
npx tsx prisma/seed.ts
```

---
## Reglas de Negocio Importantes

1. Un agente puede estar en estado: `ACTIVO`, `BAJA`, `SUSPENDIDO`, `LICENCIA_EXTENDIDA`
2. Los rangos/grados aplican al personal de tipo `SEGURIDAD` y `TECNICO`. El personal `CIVIL_BECARIO` y `CIVIL_POLICIAL` **no tiene jerarquía**
3. El CUIL es el identificador único principal del agente (no hay número de legajo separado en el sistema actual)
4. Los datos de armamento (pistola, chaleco) solo aplican a personal de `SEGURIDAD`
5. Los datos médicos (grupo sanguíneo, alergias, enfermedades, cirugías) se registran para todo el personal
3. Los francos pueden ser: ordinarios (semanales), compensatorios (por horas extra) o especiales
4. Una licencia no puede aprobarse si el agente ya tiene otra licencia activa en las mismas fechas
5. El registro de asistencia es **diario** y debe cerrarse al final del día
6. Los roles determinan qué puede ver/hacer cada usuario — implementar con **Row Level Security (RLS)** en Supabase

---

## Referencias

- `references/modelo-de-datos.md` — Esquema Prisma completo con todas las entidades
- `references/funcionalidades.md` — Descripción detallada de cada módulo y sus pantallas
