-- Renombra origenExterno -> origenInstitucional: el campo ahora es editable
-- para cualquier agente (no solo Seguridad/Técnico no-ETAC), preservando los
-- valores ya cargados.
ALTER TABLE "agentes" RENAME COLUMN "origenExterno" TO "origenInstitucional";
ALTER TABLE "agentes" RENAME COLUMN "origenExternoDetalle" TO "origenInstitucionalDetalle";
