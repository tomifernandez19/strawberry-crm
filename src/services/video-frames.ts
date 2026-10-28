import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import ffmpegPath from "ffmpeg-static"

function correrFfmpeg(args: string[], timeoutMs = 20_000): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg no disponible"))
    const proceso = spawn(ffmpegPath, args)
    let stderr = ""
    proceso.stderr.on("data", (d) => (stderr += d.toString()))
    const timer = setTimeout(() => {
      proceso.kill("SIGKILL")
      reject(new Error("ffmpeg tardó demasiado"))
    }, timeoutMs)
    proceso.on("error", (err) => {
      clearTimeout(timer)
      reject(err)
    })
    // `ffmpeg -i archivo` sin salida termina con código 1 pero imprime la duración: no es un error acá.
    proceso.on("close", () => {
      clearTimeout(timer)
      resolve({ stderr })
    })
  })
}

// Saca `cantidad` cuadros (JPEG, 720 px de ancho) repartidos a lo largo del
// video: así se ve el texto que se escribe en la historia aunque aparezca
// recién a la mitad. Devuelve [] si no se pudo (la IA entonces deriva).
export async function extraerCuadros(video: Buffer, cantidad = 3): Promise<Buffer[]> {
  const dir = await mkdtemp(path.join(tmpdir(), "historia-"))
  try {
    const archivo = path.join(dir, "video.mp4")
    await writeFile(archivo, video)

    const { stderr } = await correrFfmpeg(["-hide_banner", "-i", archivo])
    const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
    const duracion = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 3

    const cuadros: Buffer[] = []
    for (let i = 0; i < cantidad; i++) {
      const t = cantidad === 1 ? 0 : Math.min(duracion * (0.1 + (0.8 * i) / (cantidad - 1)), Math.max(duracion - 0.2, 0))
      const salida = path.join(dir, `cuadro${i}.jpg`)
      await correrFfmpeg(["-ss", t.toFixed(2), "-i", archivo, "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "4", "-y", salida])
      try {
        cuadros.push(await readFile(salida))
      } catch {
        // ese instante no produjo cuadro; se sigue con los demás
      }
    }
    return cuadros
  } catch (err) {
    console.error("No se pudieron sacar cuadros del video:", err)
    return []
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
