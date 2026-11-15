/** Internal integration boundary. This module never starts a network connection.
 * Implement approved source queries inside the company environment.
 * A snapshot must be fully validated before atomically replacing the last good data.
 */
export const connectorContract = Object.freeze({
  hue: { implemented: false, enabled: false },
  splunk: { implemented: false, enabled: false },
  requiredResult: ['records', 'observedAt', 'complete', 'readCount', 'rejectedCount'],
  requiredRecord: ['sourceId', 'title', 'area', 'status', 'observedAt']
});
export async function readSource(name) {
  if (!['hue', 'splunk'].includes(name)) throw new Error('Unknown source');
  throw new Error('INTERNAL_CONNECTOR_NOT_IMPLEMENTED');
}
