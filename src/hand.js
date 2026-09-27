import * as THREE from 'three';
import { buildBlockGeometry } from './mesher.js';
import { itemTexture } from './items.js';
import { BLOCKS } from './blocks.js';

// First-person held item, rendered in its own scene on top of the world
export class Hand {
  constructor(atlasTexture) {
    this.atlas = atlasTexture;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.id = -1;
    this.mesh = null;
    this.swingT = 1;
    this.equipT = 1;
    this.bob = 0;
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setItem(id) {
    if (id === this.id) return;
    this.id = id;
    this.equipT = 0;
    if (this.mesh) {
      this.pivot.remove(this.mesh);
      if (!this.mesh.userData.keepGeo) this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    let m;
    if (!id) {
      m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.75), new THREE.MeshBasicMaterial({ color: 0xd9a47c }));
      m.position.set(0.52, -0.5, -0.55);
      m.rotation.set(-0.35, -0.25, 0.15);
    } else if (id < 256) {
      const b = BLOCKS[id];
      m = new THREE.Mesh(buildBlockGeometry(id), new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }));
      const flat = b.model === 'cross' || b.model === 'torch';
      m.scale.setScalar(flat ? 0.55 : 0.42);
      m.position.set(0.58, -0.48, -0.9);
      m.rotation.set(0.05, flat ? -0.4 : 0.78, 0);
    } else {
      m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: itemTexture(id), alphaTest: 0.5, side: THREE.DoubleSide }));
      m.position.set(0.55, -0.38, -0.8);
      m.rotation.set(0.1, -1.1, 0.35);
    }
    m.userData.base = { p: m.position.clone(), r: m.rotation.clone(), c: m.material.color.clone() };
    this.mesh = m;
    this.pivot.add(m);
  }

  swing() { if (this.swingT >= 0.6) this.swingT = 0; }

  update(dt, { moving, light, sprinting }) {
    if (!this.mesh) return;
    this.swingT = Math.min(1, this.swingT + dt * 4);
    this.equipT = Math.min(1, this.equipT + dt * 5);
    if (moving) this.bob += dt * (sprinting ? 13 : 10);
    const amp = moving ? 1 : 0;
    const { p, r, c } = this.mesh.userData.base;
    const s = Math.sin(this.swingT * Math.PI);
    this.mesh.position.set(
      p.x + Math.sin(this.bob) * 0.02 * amp - s * 0.15,
      p.y - Math.abs(Math.cos(this.bob)) * 0.025 * amp - (1 - this.equipT) * 0.4 + s * 0.08,
      p.z - s * 0.2,
    );
    this.mesh.rotation.set(r.x - s * 0.9, r.y, r.z + s * 0.3);
    this.mesh.material.color.copy(c).multiplyScalar(light);
  }

  render(renderer) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = true;
  }
}
