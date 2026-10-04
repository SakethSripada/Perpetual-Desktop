import type { Root, Element } from 'hast';

/** Put the caret inside the final text block instead of on a new Markdown line. */
export function streamingCaret() {
  return (tree: Root) => {
    const containers = new Set(['p', 'li', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th']);
    function tail(node: Root | Element): Element | undefined {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        if (child.type === 'text' && !child.value.trim()) continue;
        if (child.type === 'element') {
          const nested = tail(child);
          if (nested) return nested;
        }
        break;
      }
      return node.type === 'element' && containers.has(node.tagName) ? node : undefined;
    }
    const target = tail(tree);
    // Markdown code blocks include a terminal newline; it is not a new token line.
    const last = target?.children.at(-1);
    if (target?.tagName === 'code' && last?.type === 'text') {
      last.value = last.value.replace(/\n+$/, '');
    }
    target?.children.push({
      type: 'element',
      tagName: 'span',
      properties: { className: ['stream-caret'], ariaHidden: 'true' },
      children: [],
    });
  };
}
