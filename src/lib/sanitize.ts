import { MAX_TITLE_LENGTH } from '../types'

// Caracteres de controle (TAB colado, NUL etc.): viram um espaço simples.
// eslint-disable-next-line no-control-regex
const CONTROL_RUNS = /[\u0000-\u001F\u007F]+/g

/**
 * Normalização única de títulos, usada na criação, na edição e no load:
 * controle → espaço, trim, corte em MAX_TITLE_LENGTH. String vazia = inválido.
 */
export function sanitizeTitle(value: string): string {
  return value.replace(CONTROL_RUNS, ' ').trim().slice(0, MAX_TITLE_LENGTH).trimEnd()
}
