import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
self.onmessage = ({ data }) => {
  try {
    if (data.byteLength > 20 * 1024 * 1024) throw new Error('Preview is limited to 20 MB');
    const view = new DataView(data);
    if (
      data.byteLength >= 84 &&
      84 + view.getUint32(80, true) * 50 === data.byteLength &&
      view.getUint32(80, true) > 200000
    ) {
      throw new Error(
        'This model is too detailed for a mobile preview. You can still request a quote.',
      );
    }
    const geometry = new STLLoader().parse(data);
    const position = geometry.attributes.position.array;
    const normal = geometry.attributes.normal.array;
    if (position.length > 1800000 || !position.length || !position.every(Number.isFinite)) {
      throw new Error('Model geometry exceeds the preview limits or contains invalid coordinates.');
    }
    self.postMessage({ position, normal }, [position.buffer, normal.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
