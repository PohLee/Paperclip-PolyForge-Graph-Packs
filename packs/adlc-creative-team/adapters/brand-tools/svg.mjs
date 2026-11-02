const forbidden = [
  /<!DOCTYPE/i, /<!ENTITY/i, /<script\b/i, /<style\b/i, /<foreignObject\b/i, /<(?:image|feImage)\b/i,
  /<\?xml-stylesheet\b/i, /\bon[a-z]+\s*=/i, /\b(?:href|xlink:href)\s*=\s*["'](?!#)/i,
  /\burl\s*\(/i, /<text\b/i
];

export function inspectLogoSvg(bytes) {
  const content = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes ?? '');
  const findings = [];
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(content)) findings.push('SVG root is missing');
  if (!/<svg\b[^>]*\bviewBox\s*=\s*["'][^"']+["']/i.test(content)) findings.push('SVG viewBox is missing');
  for (const pattern of forbidden) if (pattern.test(content)) findings.push(`Forbidden SVG content: ${pattern.source}`);
  return { valid:findings.length === 0, findings };
}
