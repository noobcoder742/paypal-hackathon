// Minimal reader for the city cell files written by scripts/build-city-3d.mjs
// (glTF 2.0 binary with KHR_mesh_quantization). Nothing is decoded or rebuilt:
// typed arrays are sliced straight out of the file and handed to the GPU.
import * as THREE from 'three';

const TYPES = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
// glTF attribute name -> name used by the building shader
const NAMES = { POSITION: 'position', COLOR_0: 'color', _ROOF: 'aRoof', _STYLE: 'aStyle' };

export function parseCellGlb(buffer) {
  const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a glb');
  const jsonLen = dv.getUint32(12, true),
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLen)));
  const binStart = 20 + jsonLen + 8;
  const meshes = {};
  const accessor = i => {
    const a = json.accessors[i],
      v = json.bufferViews[a.bufferView],
      T = TYPES[a.componentType],
      size = SIZE[a.type];
    const stride = v.byteStride ? v.byteStride / T.BYTES_PER_ELEMENT : size;
    const arr = new T(buffer, binStart + (v.byteOffset || 0) + (a.byteOffset || 0), a.count * stride);
    return { arr, size, stride, normalized: !!a.normalized, count: a.count };
  };
  json.nodes.forEach(node => {
    const prim = json.meshes[node.mesh].primitives[0],
      g = new THREE.BufferGeometry();
    for (const [name, idx] of Object.entries(prim.attributes)) {
      const { arr, size, stride, normalized } = accessor(idx),
        key = NAMES[name] || name;
      if (stride !== size)
        g.setAttribute(
          key,
          new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(arr, stride), size, 0, normalized)
        );
      else g.setAttribute(key, new THREE.BufferAttribute(arr, size, normalized));
    }
    g.setIndex(new THREE.BufferAttribute(accessor(prim.indices).arr, 1));
    const pa = json.accessors[prim.attributes.POSITION],
      s = node.scale?.[0] || 1;
    g.boundingBox = new THREE.Box3(
      new THREE.Vector3(...pa.min).multiplyScalar(s),
      new THREE.Vector3(...pa.max).multiplyScalar(s)
    );
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    // bounding volumes are in the scaled frame; geometry stays quantized and the mesh scale undoes it
    g.boundingBox.min.divideScalar(s);
    g.boundingBox.max.divideScalar(s);
    g.boundingSphere.center.divideScalar(s);
    g.boundingSphere.radius /= s;
    meshes[node.name] = { geometry: g, translation: node.translation || [0, 0, 0], scale: s };
  });
  return meshes;
}
