import multer from "multer";
import { put } from "@vercel/blob";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export async function uploadToBlob(file: Express.Multer.File): Promise<string> {
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const blob = await put(`${unique}-${file.originalname}`, file.buffer, {
    access: "public",
    contentType: file.mimetype,
  });
  return blob.url;
}
