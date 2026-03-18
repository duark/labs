import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { POWERUP_CONFIGS } from './Utils.js';

export class PowerUpSystem {
  constructor(scene) {
    this.scene = scene;
    this._active = null; // { kind, timeLeft, maxTime }
    this._fbxTemplate = null;
    this._fbxLoaded = false;
    this._fbxFailed = false;
    this._pendingMeshRequests = [];

    this._loadFBX();
  }

  _loadFBX() {
    const loader = new FBXLoader();
    loader.load(
      './assets/models/b.fbx',
      (fbx) => {
        fbx.scale.set(0.01, 0.01, 0.01);
        fbx.traverse(child => {
          if (child.isMesh) {
            child.castShadow = true;
          }
        });
        this._fbxTemplate = fbx;
        this._fbxLoaded = true;
        // Fulfill pending mesh requests
        for (const { kind, resolve } of this._pendingMeshRequests) {
          resolve(this._buildMeshFromFBX(kind));
        }
        this._pendingMeshRequests = [];
      },
      undefined,
      (err) => {
        console.warn('FBX load failed, using procedural fallback:', err);
        this._fbxFailed = true;
        this._fbxLoaded = true;
        for (const { kind, resolve } of this._pendingMeshRequests) {
          resolve(this._buildProceduralB(kind));
        }
        this._pendingMeshRequests = [];
      }
    );
  }

  _buildMeshFromFBX(kind) {
    const cfg = POWERUP_CONFIGS[kind];
    const group = new THREE.Group();
    const clone = this._fbxTemplate.clone();
    const mat = new THREE.MeshStandardMaterial({
      color: cfg.color,
      emissive: cfg.emissive,
      emissiveIntensity: cfg.emissiveIntensity,
      metalness: 0.5,
      roughness: 0.3,
    });
    clone.traverse(child => {
      if (child.isMesh) child.material = mat;
    });
    group.add(clone);
    return group;
  }

  _buildProceduralB(kind) {
    const cfg = POWERUP_CONFIGS[kind];
    const mat = new THREE.MeshStandardMaterial({
      color: cfg.color,
      emissive: cfg.emissive,
      emissiveIntensity: cfg.emissiveIntensity,
      metalness: 0.4,
      roughness: 0.4,
    });

    // Build letter B using shapes
    const shape = new THREE.Shape();
    // Stem (vertical bar)
    shape.moveTo(0, 0);
    shape.lineTo(0.2, 0);
    shape.lineTo(0.2, 1.0);
    shape.lineTo(0, 1.0);
    shape.closePath();

    const topBump = new THREE.Shape();
    topBump.moveTo(0.2, 0.5);
    topBump.quadraticCurveTo(0.8, 0.75, 0.2, 1.0);

    const botBump = new THREE.Shape();
    botBump.moveTo(0.2, 0.0);
    botBump.quadraticCurveTo(0.9, 0.25, 0.2, 0.5);

    const extSettings = { depth: 0.3, bevelEnabled: false };

    const group = new THREE.Group();

    const stemGeo = new THREE.ExtrudeGeometry(shape, extSettings);
    const stemMesh = new THREE.Mesh(stemGeo, mat);
    group.add(stemMesh);

    // Top bump
    const topShape = new THREE.Shape();
    topShape.moveTo(0.18, 0.52);
    topShape.lineTo(0.55, 0.52);
    topShape.quadraticCurveTo(0.8, 0.75, 0.55, 0.98);
    topShape.lineTo(0.18, 0.98);
    topShape.closePath();
    const topGeo = new THREE.ExtrudeGeometry(topShape, extSettings);
    const topMesh = new THREE.Mesh(topGeo, mat);
    group.add(topMesh);

    // Bottom bump
    const botShape = new THREE.Shape();
    botShape.moveTo(0.18, 0.02);
    botShape.lineTo(0.6, 0.02);
    botShape.quadraticCurveTo(0.9, 0.26, 0.6, 0.5);
    botShape.lineTo(0.18, 0.5);
    botShape.closePath();
    const botGeo = new THREE.ExtrudeGeometry(botShape, extSettings);
    const botMesh = new THREE.Mesh(botGeo, mat);
    group.add(botMesh);

    // Center and scale
    group.position.set(-0.35, -0.5, -0.15);
    group.scale.set(0.7, 0.7, 0.7);

    return group;
  }

  createPowerUpMesh(kind) {
    return new Promise((resolve) => {
      if (this._fbxLoaded) {
        if (this._fbxFailed || !this._fbxTemplate) {
          resolve(this._buildProceduralB(kind));
        } else {
          resolve(this._buildMeshFromFBX(kind));
        }
      } else {
        this._pendingMeshRequests.push({ kind, resolve });
      }
    });
  }

  activatePowerUp(kind, game) {
    const cfg = POWERUP_CONFIGS[kind];
    if (!cfg) return;

    // Deactivate current first
    this.deactivate(game);

    this._active = { kind, timeLeft: cfg.duration, maxTime: cfg.duration };

    // Apply immediate effects
    switch (kind) {
      case 'jetpack':
        if (game && game.player) {
          game.player.y = 3.5;
          game.player.vy = 0;
          game.player.state = 'jump';
        }
        break;
      case 'tenis':
        if (game && game.player) {
          game.player.enableDoubleJump();
        }
        break;
      case 'multi':
        if (game) game.scoreMultiplier = 2;
        break;
      case 'ima':
        // magnet is checked in World update
        break;
      case 'coinRush':
        // coin rush is handled in world chunk generation awareness
        break;
    }
  }

  update(dt, game) {
    if (!this._active) return;

    this._active.timeLeft -= dt;

    // Jetpack: keep player floating
    if (this._active.kind === 'jetpack' && game && game.player) {
      game.player.y += (3.5 - game.player.y) * 0.1;
      game.player.vy = 0;
      game.player.state = 'jump';
    }

    if (this._active.timeLeft <= 0) {
      this.deactivate(game);
    }
  }

  deactivate(game) {
    if (!this._active) return;

    const kind = this._active.kind;
    this._active = null;

    // Remove effects
    switch (kind) {
      case 'tenis':
        if (game && game.player) game.player.disableDoubleJump();
        break;
      case 'multi':
        if (game) game.scoreMultiplier = 1;
        break;
      case 'jetpack':
        if (game && game.player) {
          game.player.state = 'run';
        }
        break;
    }
  }

  getActive() {
    return this._active;
  }

  isJetpackActive() {
    return this._active && this._active.kind === 'jetpack';
  }

  isMagnetActive() {
    return this._active && this._active.kind === 'ima';
  }

  isCoinRushActive() {
    return this._active && this._active.kind === 'coinRush';
  }
}
