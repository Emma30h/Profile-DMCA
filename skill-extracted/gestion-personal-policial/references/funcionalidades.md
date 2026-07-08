# Funcionalidades del Sistema — Descripción Detallada

## Módulo 1: Legajos del Personal

### Descripción
Gestión completa del ciclo de vida de un agente dentro del área.

### Pantallas
- **Lista de agentes**: Tabla con filtros por tipo de personal, estado, rango. Búsqueda por nombre, apellido o legajo.
- **Detalle / Legajo**: Vista completa del agente con pestañas: Datos personales | Datos laborales | Historial de rangos | Licencias | Asistencia.
- **Alta de agente**: Formulario de creación con todos los campos obligatorios.
- **Edición**: Modificación de datos. El campo `legajo` no se puede editar una vez creado.
- **Baja**: Cambio de estado a `BAJA` con fecha y motivo. No se eliminan registros.

### Reglas
- El legajo es único e irrepetible
- Al dar de baja un agente, sus registros históricos se conservan
- Un agente de tipo TECNICO o CIVIL no puede tener rango asignado

---

## Módulo 2: Escalafón y Jerarquía

### Descripción
Gestión de la estructura jerárquica formal del personal de seguridad.

### Pantallas
- **Lista de rangos**: Tabla con todos los rangos ordenados jerárquicamente.
- **Ascenso de agente**: Formulario para registrar un cambio de rango. Genera entrada en `HistorialRango`.
- **Historial de ascensos**: Timeline del agente mostrando todos sus rangos a lo largo del tiempo.

### Escalafón completo (confirmado por el usuario)

**Cuerpo Suboficial** (orden 1–8):
1. Agente
2. Cabo
3. Cabo Primero
4. Sargento
5. Sargento Primero
6. Sargento Ayudante
7. Suboficial Principal
8. Suboficial Mayor

**Cuerpo Oficial** (orden 9–18):
9. Oficial Ayudante
10. Oficial Subinspector
11. Oficial Inspector
12. Oficial Principal
13. Subcomisario
14. Comisario
15. Comisario Inspector
16. Comisario Mayor
17. Comisario General
18. Jefe

**Cuerpo Técnico** (orden 19–26):
19. Agente Técnico
20. Cabo Técnico
21. Cabo Primero Técnico
22. Sargento Técnico
23. Sargento Primero Técnico
24. Sargento Ayudante Técnico
25. Principal Técnico
26. Mayor Técnico

> El personal `CIVIL_BECARIO` y `CIVIL_POLICIAL` **no tiene jerarquía**.

---

## Módulo 3: Turnos y Horarios

### Descripción
Asignación y gestión de turnos fijos con posibilidad de registrar excepciones.

### Pantallas
- **Configuración de turnos**: ABM de turnos (nombre, hora inicio, hora fin).
- **Asignación de turno**: Formulario para asignar un turno fijo a un agente con fecha de inicio.
- **Registro de excepciones**: Formulario para registrar horas extra, cambio de turno puntual o guardia especial.
- **Vista de planilla**: Grilla tipo calendario (semana/mes) con los agentes y sus turnos.

### Reglas
- Cada agente tiene **un único turno fijo activo** a la vez
- Las excepciones no reemplazan el turno base, se superponen puntualmente
- Las horas extra pueden generar francos compensatorios (a definir la lógica exacta con el usuario)

---

## Módulo 4: Asistencia y Presentismo

### Descripción
Registro diario de la presencia del personal.

### Pantallas
- **Carga de asistencia diaria**: Tabla del día con todos los agentes activos. El operador marca el estado de cada uno.
- **Historial de asistencia**: Filtro por agente y rango de fechas. Exportable.
- **Reporte de presentismo**: Dashboard con métricas: % de asistencia, ranking de ausentismo, tendencias.
- **Cierre de día**: Acción para "cerrar" el registro del día y evitar modificaciones posteriores (solo ADMIN puede reabrir).

### Estados de asistencia
- `PRESENTE` — Concurrió normalmente
- `AUSENTE_JUSTIFICADO` — Falta con justificación (debe indicarse motivo)
- `AUSENTE_INJUSTIFICADO` — Falta sin justificación
- `FRANCO` — Día de descanso asignado
- `LICENCIA` — Está en uso de una licencia aprobada
- `FERIADO` — Día no laborable

### Reglas
- Un agente en licencia aprobada se marca automáticamente como `LICENCIA`
- Un agente con franco registrado se marca automáticamente como `FRANCO`
- Solo OPERADOR, SUPERVISOR, ADMIN y SUPERADMIN pueden cargar asistencia

---

## Módulo 5: Licencias y Francos

### Descripción
Solicitud, aprobación y seguimiento de licencias. Gestión de francos.

### Pantallas — Licencias
- **Lista de licencias**: Filtrable por estado, tipo, agente y fecha. Vista para el aprobador.
- **Nueva solicitud de licencia**: Formulario con tipo, fechas, motivo y cálculo automático de días hábiles.
- **Detalle de licencia**: Vista con historial de estado (quién aprobó, cuándo).
- **Aprobación / Rechazo**: Acción del SUPERVISOR o ADMIN con campo de observación.

### Pantallas — Francos
- **Listado de francos**: Por agente y mes.
- **Asignación de franco**: Formulario para registrar un franco (ordinario, compensatorio o especial).

### Reglas — Licencias
- No se puede solicitar una licencia que se superponga con otra licencia activa del mismo agente
- Las licencias médicas pueden iniciarse sin aprobación previa y regularizarse después
- Solo SUPERVISOR, ADMIN y SUPERADMIN pueden aprobar o rechazar licencias
- Al aprobar una licencia, los registros de asistencia del período se actualizan automáticamente a `LICENCIA`

### Reglas — Francos
- Los francos compensatorios se generan a partir de excepciones de tipo `HORA_EXTRA`
- Un agente no puede tener franco y licencia el mismo día

---

## Navegación y Layout General

### Sidebar / Menú principal
- 🏠 Dashboard / Inicio
- 👥 Personal (Legajos)
- ⭐ Escalafón
- 🕐 Turnos
- ✅ Asistencia
- 📋 Licencias y Francos
- ⚙️ Configuración (solo ADMIN / SUPERADMIN)
- 👤 Mi Perfil

### Dashboard / Inicio
Resumen visual con:
- Total de agentes activos por tipo (seguridad / técnico / civil)
- Asistencia de hoy (% presentes)
- Licencias pendientes de aprobación
- Próximos francos de la semana
- Alertas (ej: licencias vencidas, agentes sin turno asignado)

---

## Consideraciones de UX

- La app debe ser **responsive** pero está pensada principalmente para uso en **desktop** (PC de escritorio o notebook)
- Idioma: **Español (Argentina)**
- Fechas en formato: `DD/MM/YYYY`
- Usar nomenclatura local: "Franco" en lugar de "día libre", "Legajo" en lugar de "expediente"
- Los formularios largos deben tener **guardado automático de borrador** o confirmación antes de salir
