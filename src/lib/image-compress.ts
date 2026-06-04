/**
 * Compression / redimensionnement d'une image côté browser avant upload.
 *
 * Pourquoi : les photos de téléphone modernes pèsent 3-8 Mo. Côté server
 * action Next.js, on est limité à 10 Mo (config) mais pour éviter de
 * surcharger l'upload (réseau lent côté mobile), on redimensionne en
 * client à 800x800 max + recompression JPEG qualité 0.82 → typiquement
 * <300 Ko pour une photo de profil.
 *
 * Si la compression échoue pour une raison X (format non supporté par
 * Canvas, par ex SVG ou HEIC sur Safari iOS), on renvoie le fichier
 * original — le server action acceptera quand même tant que <10 Mo.
 */
export async function compressImage(
  file: File,
  opts: { maxSize?: number; quality?: number } = {},
): Promise<File> {
  const { maxSize = 800, quality = 0.82 } = opts;

  // Format non bitmap (SVG, HEIC parfois) → on laisse passer tel quel.
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }

  try {
    const bitmap = await loadBitmap(file);
    const { width: w0, height: h0 } = bitmap;

    // Aucun redimensionnement nécessaire si déjà petit.
    if (w0 <= maxSize && h0 <= maxSize && file.size < 800_000) {
      return file;
    }

    const scale = Math.min(1, maxSize / Math.max(w0, h0));
    const w = Math.round(w0 * scale);
    const h = Math.round(h0 * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });
    if (!blob) return file;

    return new File([blob], renameToJpg(file.name), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn("compressImage failed, sending original", err);
    return file;
  }
}

/**
 * Charge le fichier en ImageBitmap (rapide) ou retombe sur un Image HTML
 * (Safari iOS qui n'a pas toujours createImageBitmap stable sur Files).
 */
async function loadBitmap(
  file: File,
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to HTMLImageElement fallback
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = url;
    });
    return img;
  } finally {
    // On peut révoquer l'URL une fois l'image chargée (le bitmap reste).
    URL.revokeObjectURL(url);
  }
}

function renameToJpg(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.jpg`;
}
