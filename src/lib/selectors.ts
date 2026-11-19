function escapeId(id: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(id) : id
}

/** Conteúdo focável do item (`div.todo-item`). */
export function itemSelector(id: string): string {
  return `.todo-item[data-id="${escapeId(id)}"]`
}

/** Wrapper `<li>` do item (colapso e deslocamento no arraste). */
export function wrapSelector(id: string): string {
  return `.todo-item-wrap[data-id="${escapeId(id)}"]`
}
