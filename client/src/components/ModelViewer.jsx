import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Bounds, Center } from '@react-three/drei';
import { unzipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { Mesh, MeshStandardMaterial, Box3, Vector3, BufferGeometry, BufferAttribute } from 'three';
import { Alert, ErrorBoundary } from './UI';
export default function ModelViewer({ file, url }) {
  const [object, setObject] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let loaded;
    let worker;
    let timeout;
    const controller = new AbortController();
    setObject(null);
    setError('');
    (async () => {
      if (file?.size > 20 * 1024 * 1024) throw new Error('Preview is limited to 20 MB');
      const buffer = file
        ? await file.arrayBuffer()
        : await fetch(url, { signal: controller.signal }).then(async (r) => {
            if (!r.ok) throw new Error('Model download failed');
            const reader = r.body.getReader();
            const chunks = [];
            let length = 0;
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              length += value.length;
              if (length > 20 * 1024 * 1024) {
                await reader.cancel();
                throw new Error('Preview is limited to 20 MB');
              }
              chunks.push(value);
            }
            const result = new Uint8Array(length);
            let offset = 0;
            for (const chunk of chunks) {
              result.set(chunk, offset);
              offset += chunk.length;
            }
            return result.buffer;
          });
      if (buffer.byteLength > 20 * 1024 * 1024) throw new Error('Preview is limited to 20 MB');
      const ext = (file?.name || url).split('?')[0].split('.').pop().toLowerCase();
      const material = new MeshStandardMaterial({ color: '#cbfa72', roughness: 0.65 });
      if (ext === 'stl') {
        const attributes = await new Promise((resolve, reject) => {
          worker = new Worker(new URL('../lib/stl.worker.js', import.meta.url), { type: 'module' });
          timeout = setTimeout(() => {
            worker.terminate();
            reject(new Error('Preview timed out. You can still submit the model for a quote.'));
          }, 10000);
          worker.onmessage = ({ data }) => {
            clearTimeout(timeout);
            worker.terminate();
            data.error ? reject(new Error(data.error)) : resolve(data);
          };
          worker.onerror = () => {
            clearTimeout(timeout);
            worker.terminate();
            reject(new Error('The model preview could not be prepared.'));
          };
          worker.postMessage(buffer, [buffer]);
        });
        if (!active) return;
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new BufferAttribute(attributes.position, 3));
        geometry.setAttribute('normal', new BufferAttribute(attributes.normal, 3));
        loaded = new Mesh(geometry, material);
      } else if (ext === 'obj') {
        if (buffer.byteLength > 8 * 1024 * 1024)
          throw new Error('OBJ preview is limited to 8 MB. The model can still be uploaded.');
        loaded = new OBJLoader().parse(new TextDecoder().decode(buffer));
        loaded.traverse((c) => {
          if (c.isMesh) c.material = material;
        });
      } else if (ext === '3mf') {
        let total = 0;
        let entries = 0;
        unzipSync(new Uint8Array(buffer), {
          filter: (entry) => {
            total += entry.originalSize;
            entries++;
            if (total > 20 * 1024 * 1024 || entries > 50 || /\.(png|jpg|jpeg)$/i.test(entry.name))
              throw new Error(
                'This 3MF archive is too complex for a browser preview. It can still be uploaded.',
              );
            return false;
          },
        });
        loaded = new ThreeMFLoader().parse(buffer);
      } else throw new Error('Preview supports STL, OBJ and 3MF');
      let vertices = 0;
      loaded.traverse((c) => {
        vertices += c.geometry?.attributes.position?.count || 0;
      });
      if (vertices > 600000) throw new Error('This model is too detailed for a browser preview.');
      const size = new Box3().setFromObject(loaded).getSize(new Vector3());
      if (!Number.isFinite(size.length()) || size.length() === 0)
        throw new Error('Model has no visible geometry');
      if (active) setObject(loaded);
    })().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
      worker?.terminate();
      loaded?.traverse((c) => {
        c.geometry?.dispose();
        if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
        else c.material?.dispose();
      });
    };
  }, [file, url]);
  return (
    <div className="viewer">
      <Alert>{error}</Alert>
      {!error && !object && <p role="status">Preparing model preview…</p>}
      {object && (
        <ErrorBoundary>
          <Canvas
            fallback={
              <p>3D previews are unavailable on this device. You can still submit your request.</p>
            }
            dpr={[1, 1.5]}
            frameloop="demand"
            camera={{ position: [3, 3, 3] }}
            gl={{ antialias: true, powerPreference: 'low-power' }}
          >
            <ambientLight intensity={1.5} />
            <directionalLight position={[5, 8, 5]} intensity={2} />
            <Suspense fallback={null}>
              <Bounds fit clip observe margin={1.3}>
                <Center>
                  <primitive object={object} />
                </Center>
              </Bounds>
            </Suspense>
            <OrbitControls makeDefault enableDamping={false} />
          </Canvas>
        </ErrorBoundary>
      )}
      <small>
        Drag to rotate · Pinch or scroll to zoom. Visual preview only; final printability is
        reviewed by the studio.
      </small>
    </div>
  );
}
