const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function compressFoodImage(file: File, maxDimension = 1400) {
  if (!allowedTypes.has(file.type)) throw new Error("รองรับเฉพาะไฟล์ JPG, PNG และ WebP");
  if (file.size > 10 * 1024 * 1024) throw new Error("รูปภาพต้องมีขนาดไม่เกิน 10 MB");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("อุปกรณ์นี้ไม่รองรับการปรับขนาดรูปภาพ");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("ไม่สามารถประมวลผลรูปภาพได้")),
      "image/webp",
      0.84,
    );
  });
}
