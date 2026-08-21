import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // El tracing de archivos de Next.js no detecta los binarios nativos de sharp
  // (usado para rotar fotos de legajo en src/app/actions/legajo.ts), así que en
  // Vercel el módulo fallaba con ERR_DLOPEN_FAILED y tiraba abajo cualquier
  // Server Action de la página que lo importa (/personal/[id]), no solo las de fotos.
  outputFileTracingIncludes: {
    "/*": ["node_modules/sharp/**/*", "node_modules/@img/**/*"],
  },
};

export default nextConfig;
