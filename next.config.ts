import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // La imagen del certificado de Carpeta Médica viaja en el FormData de una
  // Server Action (se comprime en el navegador, pero el default de 1 MB queda justo).
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  // El tracing de archivos de Next.js no detecta los binarios nativos de sharp
  // (usado para rotar fotos de legajo en src/app/actions/legajo.ts), así que en
  // Vercel el módulo fallaba con ERR_DLOPEN_FAILED y tiraba abajo cualquier
  // Server Action de la página que lo importa (/personal/[id]), no solo las de fotos.
  outputFileTracingIncludes: {
    "/*": ["node_modules/sharp/**/*", "node_modules/@img/**/*"],
  },
};

export default nextConfig;
