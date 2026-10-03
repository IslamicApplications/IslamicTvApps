/**
 * URL of the site root (where public/ files such as audio/ and hadith/ are served).
 * The build uses relative paths and built scripts sit in <site root>/assets/, so the
 * root is one level up from this module.
 */
export const SITE_ROOT: string = import.meta.env.DEV ? import.meta.env.BASE_URL : new URL('../', import.meta.url).href;
