import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  // Evitar que un error de conexión tire la app en desarrollo
  client.on("error", () => {/* ignorado — Redis no disponible */});
  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// Patrón de clave: {entidad}:{identificador}:{params_hash}
// Ej: "agentes:lista:abc123", "agentes:stats:all"
export const CACHE_TTL = {
  OPERATIVO: 60 * 5,       // 5 minutos — datos que cambian seguido
  CONFIGURACION: 60 * 60,  // 1 hora — rangos, turnos, sectores
} as const;

export async function getOrSet<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;

    const data = await fetcher();
    await redis.setex(key, ttl, JSON.stringify(data));
    return data;
  } catch {
    // Si Redis falla, devolver datos frescos sin cachear
    return fetcher();
  }
}

export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // ignorar errores de Redis en invalidación
  }
}

// Único punto de invalidación para cualquier acción que cree/edite un agente
// (estado, datos, legajo, importación). Los KPI del dashboard se calculan a
// partir de los mismos agentes pero viven en su propia key cacheada
// ("dashboard:stats:all") — invalidar solo "agentes:resumen:*" dejaba el
// dashboard mostrando datos de hasta 5 minutos antes de la acción. En vez de
// confiar en que cada acción nueva recuerde invalidar las dos, se centraliza
// acá: cualquier cambio en un agente pasa por esta única función.
export async function invalidateAgentesCache(): Promise<void> {
  await Promise.all([
    invalidatePattern("agentes:resumen:*"),
    invalidatePattern("dashboard:stats:*"),
  ]);
}
