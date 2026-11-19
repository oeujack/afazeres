/** Gera um id seguro para atributos HTML (`[A-Za-z0-9_-]`). */
export function createId(): string {
  const c = globalThis.crypto
  if (typeof c.randomUUID === 'function') return c.randomUUID()
  // randomUUID só existe em contextos seguros (http em rede local não tem);
  // getRandomValues existe em qualquer contexto.
  const bytes = c.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
