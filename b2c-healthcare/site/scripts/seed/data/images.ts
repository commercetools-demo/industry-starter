import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface ImageEntry { url: string; dimensions: { w: number; h: number } }

export const PRODUCT_IMAGES_FILE = path.join(__dirname, 'product-images.json');
export const SITE_IMAGES_FILE = path.join(__dirname, 'site-images.json');

/** Product key to images, stored in product-images.json. */
export function loadProductImages(file = PRODUCT_IMAGES_FILE): Record<string, ImageEntry[]> {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, ImageEntry[]>) : {};
}

/** Slot name to one image, stored in site-images.json. */
export function loadSiteImages(file = SITE_IMAGES_FILE): Record<string, ImageEntry> {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, ImageEntry>) : {};
}
