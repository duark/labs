import * as THREE from 'three';
import { LANES, GRAVITY, JUMP_VELOCITY, lerp, clamp } from './Utils.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.lane = 1;
    this.targetLane = 1;
    this.x = LANES[1];
    this.y = 0;
    this.vy = 0;
    this.state = 'run'; // 'run' | 'jump' | 'roll'
    this.rollTimer = 0;
    this.isAlive = true;
    this.hoverboard = false;
    this._flashTimer = 0;
    this._flashCount = 0;
    this._runCycle = 0;
    this._doubleJumpAvailable = false;

    this.group = new THREE.Group();
    this._buildMesh();
    scene.add(this.group);
  }

  _buildMesh() {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf4c08a });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a6aff });
    const pantMat = new THREE.MeshStandardMaterial({ color: 0x222244 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a0a00 });

    // Head
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
    this.head.position.set(0, 1.65, 0);
    this.head.castShadow = true;

    // Hair
    this.hair = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.52), hairMat);
    this.hair.position.set(0, 1.94, 0);

    // Body (torso)
    this.body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.35), bodyMat);
    this.body.position.set(0, 1.1, 0);
    this.body.castShadow = true;

    // Left arm
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.2), bodyMat);
    this.armL.position.set(-0.42, 1.08, 0);
    this.armL.castShadow = true;

    // Right arm
    this.armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.2), bodyMat);
    this.armR.position.set(0.42, 1.08, 0);
    this.armR.castShadow = true;

    // Left thigh
    this.thighL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.25), pantMat);
    this.thighL.position.set(-0.17, 0.65, 0);

    // Right thigh
    this.thighR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.25), pantMat);
    this.thighR.position.set(0.17, 0.65, 0);

    // Left shin
    this.shinL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, 0.22), pantMat);
    this.shinL.position.set(-0.17, 0.22, 0);

    // Right shin
    this.shinR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, 0.22), pantMat);
    this.shinR.position.set(0.17, 0.22, 0);

    // Left shoe
    this.shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.32), shoeMat);
    this.shoeL.position.set(-0.17, 0.04, 0.03);

    // Right shoe
    this.shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.32), shoeMat);
    this.shoeR.position.set(0.17, 0.04, 0.03);

    // Hoverboard
    const hoverMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00aaaa, emissiveIntensity: 1 });
    this.hoverboardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 1.2), hoverMat);
    this.hoverboardMesh.position.set(0, -0.08, 0);
    this.hoverboardMesh.visible = false;

    const parts = [
      this.head, this.hair, this.body,
      this.armL, this.armR,
      this.thighL, this.thighR,
      this.shinL, this.shinR,
      this.shoeL, this.shoeR,
      this.hoverboardMesh
    ];
    parts.forEach(p => this.group.add(p));

    this.group.position.set(LANES[1], 0, 0);
  }

  reset() {
    this.lane = 1;
    this.targetLane = 1;
    this.x = LANES[1];
    this.y = 0;
    this.vy = 0;
    this.state = 'run';
    this.rollTimer = 0;
    this.isAlive = true;
    this.hoverboard = false;
    this._flashTimer = 0;
    this._flashCount = 0;
    this._runCycle = 0;
    this._doubleJumpAvailable = false;
    this.hoverboardMesh.visible = false;
    this.group.visible = true;
    this.group.scale.set(1, 1, 1);
    this.group.position.set(LANES[1], 0, 0);
    this._resetPose();
  }

  enableDoubleJump() {
    this._doubleJumpAvailable = true;
  }

  disableDoubleJump() {
    this._doubleJumpAvailable = false;
  }

  _resetPose() {
    this.head.position.set(0, 1.65, 0);
    this.hair.position.set(0, 1.94, 0);
    this.body.position.set(0, 1.1, 0);
    this.body.scale.set(1, 1, 1);
    this.armL.position.set(-0.42, 1.08, 0);
    this.armR.position.set(0.42, 1.08, 0);
    this.armL.rotation.set(0, 0, 0);
    this.armR.rotation.set(0, 0, 0);
    this.thighL.position.set(-0.17, 0.65, 0);
    this.thighR.position.set(0.17, 0.65, 0);
    this.shinL.position.set(-0.17, 0.22, 0);
    this.shinR.position.set(0.17, 0.22, 0);
    this.shoeL.position.set(-0.17, 0.04, 0.03);
    this.shoeR.position.set(0.17, 0.04, 0.03);
    this.thighL.rotation.set(0, 0, 0);
    this.thighR.rotation.set(0, 0, 0);
    this.shinL.rotation.set(0, 0, 0);
    this.shinR.rotation.set(0, 0, 0);
    this.group.scale.set(1, 1, 1);
  }

  update(dt, input) {
    if (!this.isAlive) return;

    // Flash animation
    if (this._flashCount > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) {
        this._flashTimer = 0.08;
        this._flashCount--;
        this.group.visible = !this.group.visible;
        if (this._flashCount === 0) this.group.visible = true;
      }
    }

    // Lane change
    if (input.consume('left') && this.targetLane > 0) {
      this.targetLane--;
    }
    if (input.consume('right') && this.targetLane < 2) {
      this.targetLane++;
    }

    // Jump
    if (input.consume('jump')) {
      if (this.state !== 'jump') {
        this.vy = JUMP_VELOCITY;
        this.state = 'jump';
        this._doubleJumpAvailable = false; // consumed first jump
      } else if (this._doubleJumpAvailable) {
        // double jump
        this.vy = JUMP_VELOCITY;
        this._doubleJumpAvailable = false;
      }
    }

    // Roll
    if (input.consume('roll')) {
      if (this.state === 'jump') {
        this.vy = Math.min(this.vy, -8);
      } else {
        this.state = 'roll';
        this.rollTimer = 0.7;
      }
    }

    // Smooth X movement
    const targetX = LANES[this.targetLane];
    this.x = lerp(this.x, targetX, Math.min(1, dt * 15));

    // Gravity & vertical movement (skip if jetpack active - handled externally)
    if (this.state === 'jump') {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.state = 'run';
      }
    }

    // Roll timer
    if (this.state === 'roll') {
      this.rollTimer -= dt;
      if (this.rollTimer <= 0) {
        this.state = 'run';
        this.rollTimer = 0;
      }
    }

    // Update group position
    this.group.position.set(this.x, this.y, 0);

    // Animate
    this._animate(dt);
  }

  _animate(dt) {
    this._runCycle += dt * 8;

    if (this.state === 'run') {
      this._resetPose();
      const s = Math.sin(this._runCycle);
      const c = Math.cos(this._runCycle);
      // Leg swing
      this.thighL.rotation.x = s * 0.5;
      this.thighR.rotation.x = -s * 0.5;
      this.shinL.rotation.x = Math.max(0, -c * 0.3);
      this.shinR.rotation.x = Math.max(0, c * 0.3);
      // Arm swing (opposite to legs)
      this.armL.rotation.x = -s * 0.4;
      this.armR.rotation.x = s * 0.4;
    } else if (this.state === 'jump') {
      this._resetPose();
      // Arms up
      this.armL.rotation.x = -1.0;
      this.armR.rotation.x = -1.0;
      // Legs tucked
      this.thighL.rotation.x = 0.4;
      this.thighR.rotation.x = 0.4;
      this.shinL.rotation.x = 0.6;
      this.shinR.rotation.x = 0.6;
    } else if (this.state === 'roll') {
      // Crouch entire group
      this.group.scale.set(1, 0.55, 1);
      this.head.position.set(0, 1.65, 0);
      this.armL.rotation.x = 0.5;
      this.armR.rotation.x = 0.5;
    }

    // Hoverboard visibility
    this.hoverboardMesh.visible = this.hoverboard;
  }

  getHitbox() {
    if (this.state === 'roll') {
      return { xMin: this.x - 0.55, xMax: this.x + 0.55, yMin: this.y, yMax: this.y + 1.0 };
    }
    return { xMin: this.x - 0.4, xMax: this.x + 0.4, yMin: this.y, yMax: this.y + 2.0 };
  }

  takeDamage() {
    if (this.hoverboard) {
      this.hoverboard = false;
      this.hoverboardMesh.visible = false;
      // Flash player
      this._flashCount = 8;
      this._flashTimer = 0.08;
      return false; // survived
    }
    this.isAlive = false;
    return true; // died
  }
}
