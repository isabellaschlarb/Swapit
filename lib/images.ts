// Shrinks a photo in the browser before uploading.
// Phone photos are often 3–10 MB; this makes them ~200–500 KB JPEGs,
// so uploads are fast and the feed loads quickly.
export async function shrinkImage(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process photo"))),
      "image/jpeg",
      quality,
    ),
  );
}

// A random file name like "1731600000000-k3j9x2.jpg".
export function randomFileName(extension = "jpg") {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
}

// Turns a photo into a "data:image/jpeg;base64,..." string so it can be
// sent to our AI route as JSON.
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
