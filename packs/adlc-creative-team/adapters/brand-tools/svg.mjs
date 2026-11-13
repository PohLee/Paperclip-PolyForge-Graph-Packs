const elements = new Set('svg g path rect circle ellipse line polyline polygon defs linearGradient radialGradient stop clipPath mask use title desc symbol'.split(' '));
const attributes = new Set('xmlns id viewBox width height x y x1 x2 y1 y2 cx cy r rx ry d points transform fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset opacity clip-path clip-rule mask offset stop-color stop-opacity gradientUnits gradientTransform spreadMethod preserveAspectRatio href version'.split(' '));

export function inspectLogoSvg(bytes) {
  const content = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes ?? '');
  const findings = [];
  const fail = message => findings.push(message);
  if (/&|<!|\\/.test(content)) fail('Forbidden SVG content');
  let source = content.replace(/^\s*<\?xml\s+[^?]*\?>/, '');
  if (/<\?/.test(source)) fail('Forbidden processing instruction');
  const stack = [];
  let root = false, viewBox = false, position = 0;
  const tags = /<([^<>]*)>/g;
  for (const match of source.matchAll(tags)) {
    const text = source.slice(position, match.index);
    if (text.includes('<') || text.includes('>') || (text.trim() && !['title','desc'].includes(stack.at(-1)))) fail('Invalid SVG text');
    position = match.index + match[0].length;
    let body = match[1].trim();
    if (body.startsWith('/')) {
      const name = body.slice(1).trim();
      if (!/^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/.test(name) || stack.pop() !== name) fail('Invalid closing element');
      continue;
    }
    const selfClosing = body.endsWith('/');
    if (selfClosing) body = body.slice(0,-1).trimEnd();
    const nameMatch = /^([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)(?=\s|$)/.exec(body);
    if (!nameMatch) { fail('Invalid element'); continue; }
    const name = nameMatch[1], local = name.split(':').at(-1);
    if (!elements.has(local)) fail(`Forbidden element: ${name}`);
    if (!root) { root = true; if (local !== 'svg') fail('SVG root is missing'); }
    else if (!stack.length) fail('Multiple SVG roots');
    let rest = body.slice(name.length), seen = new Set();
    while (rest.trim()) {
      const attribute = /^\s+([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)\s*=\s*(["'])(.*?)\2/s.exec(rest);
      if (!attribute) { fail('Invalid SVG attribute'); break; }
      const [, key,, value] = attribute, localKey = key.split(':').at(-1);
      if (seen.has(key)) fail('Duplicate SVG attribute');
      seen.add(key);
      if (!(key.startsWith('xmlns:') || attributes.has(localKey)) || localKey === 'style') fail(`Forbidden attribute: ${key}`);
      if (localKey === 'href' && (local !== 'use' || !/^#[A-Za-z_][\w.-]*$/.test(value))) fail('Invalid SVG reference');
      if (/url\s*\(/i.test(value) && !/^url\(#[A-Za-z_][\w.-]*\)$/.test(value)) fail('Invalid SVG URL');
      if (local === 'svg' && localKey === 'viewBox' && value.trim()) viewBox = true;
      rest = rest.slice(attribute[0].length);
    }
    if (!selfClosing) stack.push(name);
  }
  if (source.slice(position).trim() || stack.length || !root) fail('Invalid SVG structure');
  if (!viewBox) fail('SVG viewBox is missing');
  return { valid:findings.length === 0, findings };
}
