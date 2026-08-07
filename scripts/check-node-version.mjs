export const MINIMUM_NODE_VERSION = "24.0.0";

export function parseNodeVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  return match ? match.slice(1).map(Number) : null;
}

export function supportsNodeVersion(version) {
  const parsed = parseNodeVersion(version);
  const minimum = parseNodeVersion(MINIMUM_NODE_VERSION);
  if (!parsed || !minimum) return false;

  for (let index = 0; index < minimum.length; index += 1) {
    if (parsed[index] > minimum[index]) return true;
    if (parsed[index] < minimum[index]) return false;
  }
  return true;
}

export function nodeVersionError(version) {
  return `Version Node.js incompatible : ${version} détectée ; ${MINIMUM_NODE_VERSION} minimum requis.`;
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) {
  const detected = process.versions.node;
  if (!supportsNodeVersion(detected)) {
    console.error(nodeVersionError(detected));
    process.exitCode = 1;
  }
}
