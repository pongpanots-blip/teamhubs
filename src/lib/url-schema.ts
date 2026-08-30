import { z } from "zod";

export const httpUrlSchema = z
  .string()
  .url()
  .refine((u) => {
    try {
      return /^https?:$/.test(new URL(u).protocol);
    } catch {
      return false;
    }
  }, "must be an http(s) URL");
