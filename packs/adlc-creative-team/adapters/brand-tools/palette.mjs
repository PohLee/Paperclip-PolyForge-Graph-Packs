const hex = value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
const channel = value => {
  const x = value / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const luminance = color => {
  const values = [1, 3, 5].map(i => channel(Number.parseInt(color.slice(i, i + 2), 16)));
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
};

export function contrastRatio(foreground, background) {
  if (!hex(foreground) || !hex(background)) throw new TypeError('Colors must be six-digit sRGB hex values');
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

export function auditPalette(roles, usages) {
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) throw new TypeError('roles must map semantic names to hex colors');
  if (!Array.isArray(usages)) throw new TypeError('usages must list actual foreground/background pairs');
  const findings = usages.map((usage, index) => {
    const { foreground, background, purpose } = usage ?? {};
    if (!['normal-text', 'large-text', 'ui-component'].includes(purpose)) throw new TypeError(`Usage ${index} needs a supported purpose`);
    const fg = roles[foreground], bg = roles[background];
    if (!hex(fg) || !hex(bg)) throw new TypeError(`Usage ${index} refers to a missing or invalid color role`);
    const ratio = contrastRatio(fg, bg);
    const threshold = purpose === 'normal-text' ? 4.5 : 3;
    return { foreground, background, purpose, ratio: Number(ratio.toFixed(2)), threshold, status: ratio >= threshold ? 'pass' : 'gate' };
  });
  return { status: findings.some(item => item.status === 'gate') ? 'gate' : 'pass', findings };
}
