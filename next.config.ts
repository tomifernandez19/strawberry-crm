import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg se usa para sacar cuadros de las historias en video; es un binario,
  // así que no se empaqueta con el código y hay que incluirlo en el deploy.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/webhooks/instagram": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;
