import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is for the Docker image; Vercel uses its own build output.
  output: process.env.VERCEL ? undefined : "standalone",
  // No canto padrão, o indicador cobre o nome no rodapé do menu, que leva ao perfil.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
