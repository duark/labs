import * as THREE from 'three';
import { LANES, CHUNK_LEN, POWERUP_CONFIGS, pick, rnd } from './Utils.js';

// ─── Chunk templates ────────────────────────────────────────────────────────

function coinLine(lane, zStart, zEnd, step = 2.5, y = 0.8) {
  const entities = [];
  for (let z = zStart; z <= zEnd; z += step) {
    entities.push({ type: 'coin', lane, z, y });
  }
  return entities;
}

function chunkCLEAR() {
  const entities = [];
  // Three coin lines
  entities.push(...coinLine(0, 4, 30, 3));
  entities.push(...coinLine(1, 4, 30, 3));
  entities.push(...coinLine(2, 4, 30, 3));
  // Zigzag bonus coins
  for (let z = 6; z < 34; z += 4) {
    const lane = Math.floor((z / 4) % 3);
    entities.push({ type: 'coin', lane, z: z + 1, y: 0.8 });
  }
  return entities;
}

function chunkTRAIN_L() {
  return [
    { type: 'train', lane: 0, z: 10 },
    { type: 'train', lane: 0, z: 14 },
    ...coinLine(1, 4, 28, 3),
    ...coinLine(2, 4, 28, 3),
  ];
}

function chunkTRAIN_R() {
  return [
    { type: 'train', lane: 2, z: 10 },
    { type: 'train', lane: 2, z: 14 },
    ...coinLine(0, 4, 28, 3),
    ...coinLine(1, 4, 28, 3),
  ];
}

function chunkTRAIN_C() {
  return [
    { type: 'train', lane: 1, z: 10 },
    { type: 'train', lane: 1, z: 14 },
    ...coinLine(0, 4, 28, 3),
    ...coinLine(2, 4, 28, 3),
  ];
}

function chunkTRAIN_LC() {
  return [
    { type: 'train', lane: 0, z: 12 },
    { type: 'train', lane: 1, z: 12 },
    ...coinLine(2, 4, 30, 3),
  ];
}

function chunkTRAIN_RC() {
  return [
    { type: 'train', lane: 1, z: 12 },
    { type: 'train', lane: 2, z: 12 },
    ...coinLine(0, 4, 30, 3),
  ];
}

function chunkLOW_BARRIERS() {
  const entities = [];
  const blocked = pick([0, 1, 2]);
  for (let z = 8; z <= 28; z += 5) {
    const lane = (z % 3);
    entities.push({ type: 'low_barrier', lane, z });
    // Coins on safe lanes
    for (let l = 0; l < 3; l++) {
      if (l !== lane) entities.push({ type: 'coin', lane: l, z: z - 1, y: 0.8 });
    }
  }
  return entities;
}

function chunkHIGH_BARRIER() {
  return [
    { type: 'high_barrier', lane: 1, z: 12 },
    ...coinLine(0, 6, 22, 3, 1.5),
    ...coinLine(2, 6, 22, 3, 1.5),
  ];
}

function chunkPOWERUP() {
  const kinds = ['jetpack', 'tenis', 'ima', 'multi', 'coinRush'];
  const kind = pick(kinds);
  const lane = pick([0, 1, 2]);
  return [
    { type: 'powerup', kind, lane, z: 12 },
    ...coinLine(0, 4, 20, 4),
    ...coinLine(1, 4, 20, 4),
    ...coinLine(2, 4, 20, 4),
  ];
}

function chunkCOIN_ARC() {
  const entities = [];
  const lane = pick([0, 1, 2]);
  // Arc of coins (jump to collect)
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const z = 6 + i * 3;
    const y = 0.8 + Math.sin(t * Math.PI) * 2.5;
    entities.push({ type: 'coin', lane, z, y });
  }
  // Ground coins on other lanes
  for (let l = 0; l < 3; l++) {
    if (l !== lane) entities.push(...coinLine(l, 4, 26, 4));
  }
  return entities;
}

const CHUNK_TEMPLATES = [
  chunkCLEAR, chunkCLEAR,
  chunkTRAIN_L, chunkTRAIN_R, chunkTRAIN_C,
  chunkTRAIN_LC, chunkTRAIN_RC,
  chunkLOW_BARRIERS,
  chunkHIGH_BARRIER,
  chunkPOWERUP,
  chunkCOIN_ARC,
];

// ─── Materials (shared) ─────────────────────────────────────────────────────

const TRAIN_MAT = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 });
const LOW_BAR_MAT = new THREE.MeshStandardMaterial({ color: 0xFFDD00, roughness: 0.5 });
const HIGH_BAR_MAT = new THREE.MeshStandardMaterial({ color: 0xFF2222, emissive: 0x880000, emissiveIntensity: 0.5 });
const COIN_MAT = new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0xFFAA00, emissiveIntensity: 0.8, metalness: 0.9, roughness: 0.1 });

// ─── World class ─────────────────────────────────────────────────────────────

export class World {
  constructor(scene) {
    this.scene = scene;
    this.coins = [];
    this.obstacles = [];
    this.powerUpEntities = [];
    this._chunks = [];
    this._lastChunkZ = 0;
    this._powerUpSystem = null;
    this._buildEnvironment();
    this._spawnInitialChunks();
  }

  setPowerUpSystem(ps) {
    this._powerUpSystem = ps;
  }

  _buildEnvironment() {
    // Ground
    const groundGeo = new THREE.PlaneGeometry(20, 1000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.01, -480);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Lane dividers
    const divMat = new THREE.MeshStandardMaterial({ color: 0x333355 });
    [-1.25, 1.25].forEach(x => {
      const div = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 1000), divMat);
      div.position.set(x, 0.01, -480);
      this.scene.add(div);
    });

    // Rails (edge lines)
    const railMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.1 });
    [-4.8, 4.8].forEach(x => {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1000, 6), railMat);
      rail.position.set(x, 0.08, -480);
      this.scene.add(rail);
    });

    // Side walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x080810 });
    [-6.5, 6.5].forEach(x => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 1000), wallMat);
      wall.position.set(x, 4, -480);
      this.scene.add(wall);
    });

    // Background city buildings
    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const h = rnd(4, 18);
      const w = rnd(2, 5);
      const d = rnd(2, 6);
      const z = rnd(-5, -500);
      const x = side * rnd(9, 22);

      const buildMat = new THREE.MeshStandardMaterial({
        color: 0x0a0a18,
        emissive: new THREE.Color(rnd(0, 0.05), rnd(0, 0.05), rnd(0.05, 0.15)),
        emissiveIntensity: 1,
      });
      const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildMat);
      building.position.set(x, h / 2, z);
      this.scene.add(building);

      // Window glow strips
      const winMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(rnd(0.2, 1), rnd(0.2, 0.8), rnd(0, 0.3)),
        emissiveIntensity: 2,
      });
      for (let r = 0; r < Math.floor(h / 2); r++) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.15, 0.05), winMat);
        win.position.set(x, r * 2 + 1, z - d / 2 - 0.02);
        this.scene.add(win);
      }
    }

    // Fog
    this.scene.fog = new THREE.Fog(0x0a0a0f, 80, 180);
  }

  _spawnInitialChunks() {
    this._lastChunkZ = -20;
    for (let i = 0; i < 4; i++) {
      this._spawnChunk();
    }
  }

  _spawnChunk() {
    const template = pick(CHUNK_TEMPLATES);
    const entities = template();
    const chunkGroup = new THREE.Group();
    chunkGroup.position.z = this._lastChunkZ;

    const chunkData = {
      group: chunkGroup,
      baseZ: this._lastChunkZ,
      worldZ: this._lastChunkZ,
      coins: [],
      obstacles: [],
      powerUps: [],
    };

    entities.forEach(e => {
      const laneX = LANES[e.lane];
      let mesh = null;

      if (e.type === 'coin') {
        const geo = new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12);
        mesh = new THREE.Mesh(geo, COIN_MAT.clone());
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(laneX, e.y, -e.z);
        mesh.castShadow = true;

        const coinObj = {
          mesh,
          lane: e.lane,
          localZ: -e.z,
          worldZ: this._lastChunkZ - e.z,
          x: laneX,
          y: e.y,
          collected: false,
          _rotOffset: Math.random() * Math.PI * 2,
        };
        chunkData.coins.push(coinObj);
        this.coins.push(coinObj);

      } else if (e.type === 'train') {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.8, 4), TRAIN_MAT.clone());
        mesh.position.set(laneX, 1.4, -e.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Train detail — window strip
        const winMat = new THREE.MeshStandardMaterial({ color: 0x88bbff, emissive: 0x4488cc, emissiveIntensity: 0.5 });
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.05), winMat);
        win.position.set(0, 0.5, -2.02);
        mesh.add(win);

        const obstacleObj = {
          mesh,
          type: 'train',
          lane: e.lane,
          localZ: -e.z,
          worldZ: this._lastChunkZ - e.z,
          x: laneX,
          hit: false,
        };
        chunkData.obstacles.push(obstacleObj);
        this.obstacles.push(obstacleObj);

      } else if (e.type === 'low_barrier') {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 0.8), LOW_BAR_MAT.clone());
        mesh.position.set(laneX, 0.35, -e.z);
        mesh.castShadow = true;

        // Stripe detail
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        for (let i = -0.6; i <= 0.6; i += 0.4) {
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.82), stripeMat);
          stripe.position.set(i, 0, 0);
          mesh.add(stripe);
        }

        const obstacleObj = {
          mesh,
          type: 'low_barrier',
          lane: e.lane,
          localZ: -e.z,
          worldZ: this._lastChunkZ - e.z,
          x: laneX,
          hit: false,
        };
        chunkData.obstacles.push(obstacleObj);
        this.obstacles.push(obstacleObj);

      } else if (e.type === 'high_barrier') {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 0.5), HIGH_BAR_MAT.clone());
        mesh.position.set(laneX, 1.25, -e.z);
        mesh.castShadow = true;

        const obstacleObj = {
          mesh,
          type: 'high_barrier',
          lane: e.lane,
          localZ: -e.z,
          worldZ: this._lastChunkZ - e.z,
          x: laneX,
          hit: false,
        };
        chunkData.obstacles.push(obstacleObj);
        this.obstacles.push(obstacleObj);

      } else if (e.type === 'powerup') {
        const cfg = POWERUP_CONFIGS[e.kind] || {};
        const geo = new THREE.OctahedronGeometry(0.35, 0);
        const mat = new THREE.MeshStandardMaterial({
          color: cfg.color || 0xffffff,
          emissive: cfg.emissive || 0xffffff,
          emissiveIntensity: cfg.emissiveIntensity || 1,
          metalness: 0.6,
          roughness: 0.2,
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(laneX, 1.2, -e.z);

        // Point light matching power-up color
        const pl = new THREE.PointLight(cfg.color || 0xffffff, 3, 5);
        pl.position.copy(mesh.position);
        chunkGroup.add(pl);

        const puObj = {
          mesh,
          kind: e.kind,
          lane: e.lane,
          localZ: -e.z,
          worldZ: this._lastChunkZ - e.z,
          x: laneX,
          collected: false,
          _light: pl,
          _bobOffset: Math.random() * Math.PI * 2,
        };
        chunkData.powerUps.push(puObj);
        this.powerUpEntities.push(puObj);

        // Async replace octahedron placeholder with b.fbx mesh
        if (this._powerUpSystem) {
          this._powerUpSystem.createPowerUpMesh(e.kind).then(bMesh => {
            if (puObj.collected) return;
            bMesh.position.copy(mesh.position);
            chunkGroup.remove(mesh);
            chunkGroup.add(bMesh);
            puObj.mesh = bMesh;
          });
        }
      }

      if (mesh) chunkGroup.add(mesh);
    });

    this.scene.add(chunkGroup);
    this._chunks.push(chunkData);
    this._lastChunkZ -= CHUNK_LEN;
  }

  update(dt, speed, player, powerUpSystem) {
    const result = { coins: 0, powerup: null };
    const moveZ = speed * dt;

    // Track where next chunk should spawn (moves with the world)
    this._lastChunkZ += moveZ;

    // Move all chunks
    for (const chunk of this._chunks) {
      chunk.worldZ += moveZ;
      chunk.group.position.z = chunk.worldZ;

      // Update world positions for collision
      for (const c of chunk.coins) {
        c.worldZ = chunk.worldZ + c.localZ;
      }
      for (const o of chunk.obstacles) {
        o.worldZ = chunk.worldZ + o.localZ;
      }
      for (const p of chunk.powerUps) {
        p.worldZ = chunk.worldZ + p.localZ;
      }
    }

    // Animate coins and power-ups
    const time = performance.now() * 0.001;
    for (const c of this.coins) {
      if (!c.collected && c.mesh) {
        c.mesh.rotation.z = time * 3 + c._rotOffset;
      }
    }
    for (const p of this.powerUpEntities) {
      if (!p.collected && p.mesh) {
        p.mesh.rotation.y = time * 2 + p._bobOffset;
        p.mesh.position.y = 1.2 + Math.sin(time * 2 + p._bobOffset) * 0.2;
        if (p._light) {
          p._light.position.y = 1.2 + Math.sin(time * 2 + p._bobOffset) * 0.2;
        }
      }
    }

    // Collect coins
    const collected = this._checkCoinCollect(player, powerUpSystem);
    result.coins = collected;

    // Collect power-ups
    const pu = this._checkPowerUpCollect(player);
    if (pu) result.powerup = pu;

    // Despawn old chunks
    this._chunks = this._chunks.filter(chunk => {
      if (chunk.worldZ > 20) {
        this.scene.remove(chunk.group);
        // Remove from global arrays
        chunk.coins.forEach(c => {
          const idx = this.coins.indexOf(c);
          if (idx !== -1) this.coins.splice(idx, 1);
        });
        chunk.obstacles.forEach(o => {
          const idx = this.obstacles.indexOf(o);
          if (idx !== -1) this.obstacles.splice(idx, 1);
        });
        chunk.powerUps.forEach(p => {
          const idx = this.powerUpEntities.indexOf(p);
          if (idx !== -1) this.powerUpEntities.splice(idx, 1);
        });
        return false;
      }
      return true;
    });

    // Spawn new chunks
    if (this._lastChunkZ > -120) {
      this._spawnChunk();
    }

    return result;
  }

  _checkCoinCollect(player, powerUpSystem) {
    let count = 0;
    const magnetActive = powerUpSystem && powerUpSystem.isMagnetActive();
    const magnetRadius = 5;

    for (const coin of this.coins) {
      if (coin.collected) continue;

      const dz = Math.abs(coin.worldZ);
      const dx = Math.abs(coin.x - player.x);

      let collect = false;
      if (dz < 1.5 && dx < 1.8) {
        collect = true;
      } else if (magnetActive) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < magnetRadius) {
          // Move coin toward player
          const dirX = player.x - coin.x;
          const speed = 20;
          coin.x += dirX * 0.15;
          if (coin.mesh) coin.mesh.position.x = coin.x;
          if (dz < 1.5 && Math.abs(coin.x - player.x) < 1.8) collect = true;
        }
      }

      if (collect) {
        coin.collected = true;
        // Animate collection
        if (coin.mesh) {
          coin.mesh.scale.set(1.5, 1.5, 1.5);
          setTimeout(() => {
            if (coin.mesh && coin.mesh.parent) coin.mesh.parent.remove(coin.mesh);
          }, 100);
        }
        count++;
      }
    }
    return count;
  }

  _checkPowerUpCollect(player) {
    for (const pu of this.powerUpEntities) {
      if (pu.collected) continue;
      const dz = Math.abs(pu.worldZ);
      const dx = Math.abs(pu.x - player.x);
      if (dz < 1.8 && dx < 1.8) {
        pu.collected = true;
        if (pu.mesh && pu.mesh.parent) pu.mesh.parent.remove(pu.mesh);
        if (pu._light && pu._light.parent) pu._light.parent.remove(pu._light);
        return pu.kind;
      }
    }
    return null;
  }

  checkObstacleHit(player) {
    if (!player.isAlive) return null;
    const hb = player.getHitbox();

    for (const obs of this.obstacles) {
      if (obs.hit) continue;

      // Z proximity: obstacle must be near player (player at z=0)
      const dz = Math.abs(obs.worldZ);
      if (dz > 1.8) continue;

      // X proximity
      const dx = Math.abs(obs.x - player.x);
      if (dx > 1.8) continue;

      // Type-specific checks
      if (obs.type === 'low_barrier') {
        // Only hits if NOT rolling and within height
        if (player.state !== 'roll' && hb.yMin < 0.7) {
          obs.hit = true;
          return obs;
        }
      } else if (obs.type === 'high_barrier') {
        // Can jump over if player feet are above barrier top (~2.5 units)
        if (player.y < 2.0) {
          obs.hit = true;
          return obs;
        }
      } else if (obs.type === 'train') {
        // Cannot jump over trains (too tall)
        obs.hit = true;
        return obs;
      }
    }
    return null;
  }

  reset() {
    // Remove all chunks
    for (const chunk of this._chunks) {
      this.scene.remove(chunk.group);
    }
    this._chunks = [];
    this.coins = [];
    this.obstacles = [];
    this.powerUpEntities = [];
    this._lastChunkZ = 0;
    this._spawnInitialChunks();
  }
}
