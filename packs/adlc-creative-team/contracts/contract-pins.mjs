const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const nonempty = value => typeof value === 'string' && Boolean(value.trim());
const sections = ['product', 'design', 'technical'];
const assert = (ok, message) => { if (!ok) throw new Error(message); };

export function validateContractPins(pins) {
  assert(Array.isArray(pins) && pins.length && pins.every(pin =>
    nonempty(pin?.contractId) && sections.includes(pin.section) && sha(pin.commit)),
  'Expected contract_pins with contract IDs, sections and merge commits');
  const keys = pins.map(pin => JSON.stringify([pin.contractId, pin.section]));
  assert(new Set(keys).size === keys.length, 'Duplicate contract pin');
  return pins;
}
