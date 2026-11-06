// Components only create nodes and text; caller-provided text is never parsed as HTML.
export function el(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === false || value == null) continue;
    if (key === 'className') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of [children].flat(Infinity)) {
    if (child != null && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

let sequence = 0;
export function uniqueId(prefix = 'field') { return `${prefix}-${++sequence}`; }
