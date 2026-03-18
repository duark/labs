import * as THREE from 'three';
import { InputManager } from './Input.js';
import { Player } from './Player.js';
import { World } from './World.js';
import { PowerUpSystem } from './PowerUpSystem.js';
import { MissionSystem } from './Missions.js';
import { HUD } from './HUD.js';
import { BASE_SPEED, MAX_SPEED, SPEED_INC, lerp } from './Utils.js';

export class Game {
  constructor() {
    this.state = 'MENU';
    this.score = 0;
    this.coins = 0;
    this.distance = 0;
    this.speed = BASE_SPEED;
    this.scoreMultiplier = 1;
    this._lastT = 0;
    this._raf = null;

    this._initRenderer();
    this._initScene();
    this._initLights();
    this._initCamera();

    this.input = new InputManager();
    this.player = new Player(this.scene);
    this.world = new World(this.scene);
    this.powerUpSystem = new PowerUpSystem(this.scene);
    this.world.setPowerUpSystem(this.powerUpSystem);
    this.missions = new MissionSystem();
    this.hud = new HUD();

    this._setupUI();
    this._setupResize();

    // Initial render
    this.renderer.render(this.scene, this.camera);
    this._showScreen('menu-screen');
    this._updateMenuHighScore();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    const app = document.getElementById('app');
    if (app) app.appendChild(this.renderer.domElement);
    else document.body.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 6, 12);
    this.camera.lookAt(0, 1, -5);
  }

  _initLights() {
    // Ambient
    const ambient = new THREE.AmbientLight(0x333355, 0.8);
    this.scene.add(ambient);

    // Directional (sun + shadow)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 20, -10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);

    // Red neon point light
    const redNeon = new THREE.PointLight(0xff3b3b, 3, 12);
    redNeon.position.set(-8, 3, -20);
    this.scene.add(redNeon);

    // Blue neon point light
    const blueNeon = new THREE.PointLight(0x3b8bff, 3, 12);
    blueNeon.position.set(8, 3, -30);
    this.scene.add(blueNeon);

    // Hemisphere
    const hemi = new THREE.HemisphereLight(0x223366, 0x111122, 0.5);
    this.scene.add(hemi);
  }

  _setupUI() {
    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn.bind(this));
    };

    bind('play-btn', this.startGame);
    bind('pause-btn', this.pause);
    bind('resume-btn', this.resume);
    bind('restart-btn', this.restart);
    bind('menu-btn', this.goToMenu);
    bind('pause-menu-btn', this.goToMenu);
    bind('continue-btn', this._continue);
  }

  _setupResize() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  _showScreen(id) {
    const screens = ['menu-screen', 'gameover-screen', 'pause-screen'];
    screens.forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = s === id ? 'flex' : 'none';
    });
  }

  _hideAllScreens() {
    ['menu-screen', 'gameover-screen', 'pause-screen'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  _updateMenuHighScore() {
    const hs = localStorage.getItem('highScore') || '0';
    const el = document.getElementById('high-score-value');
    if (el) el.textContent = parseInt(hs).toLocaleString();
  }

  startGame() {
    this.state = 'RUNNING';
    this.score = 0;
    this.coins = 0;
    this.distance = 0;
    this.speed = BASE_SPEED;
    this.scoreMultiplier = 1;

    this.player.reset();
    this.world.reset();
    this.powerUpSystem.deactivate(null);
    this.missions.reset();

    this._hideAllScreens();
    this.hud.show();

    this._lastT = performance.now();
    this._loop();
  }

  pause() {
    if (this.state !== 'RUNNING') return;
    this.state = 'PAUSED';
    cancelAnimationFrame(this._raf);
    this._showScreen('pause-screen');
  }

  resume() {
    if (this.state !== 'PAUSED') return;
    this.state = 'RUNNING';
    this._hideAllScreens();
    this._lastT = performance.now();
    this._loop();
  }

  _continue() {
    // Spend 5 keys to continue (simple implementation: free continue for now)
    const keys = parseInt(localStorage.getItem('keys') || '0');
    if (keys >= 5) {
      localStorage.setItem('keys', keys - 5);
    }
    // Revive player
    this.player.isAlive = true;
    this.player.y = 0;
    this.player.vy = 0;
    this.player.state = 'run';
    // Give brief invincibility
    this.player.hoverboard = true;
    this.state = 'RUNNING';
    this._hideAllScreens();
    this.hud.show();
    this._lastT = performance.now();
    this._loop();
  }

  _loop() {
    if (this.state !== 'RUNNING') return;
    this._raf = requestAnimationFrame((t) => {
      if (this.state !== 'RUNNING') return;
      const dt = Math.min((t - this._lastT) / 1000, 0.05);
      this._lastT = t;
      this._update(dt);
      this.renderer.render(this.scene, this.camera);
      this._loop();
    });
  }

  _update(dt) {
    // Pause check
    if (this.input.consume('pause')) {
      this.pause();
      return;
    }

    // Speed increase
    this.speed = Math.min(MAX_SPEED, this.speed + SPEED_INC * dt);
    this.distance += this.speed * dt;

    // Player update
    this.player.update(dt, this.input);

    // Power-up update (before world, so jetpack keeps player up)
    this.powerUpSystem.update(dt, this);

    // World update
    const collected = this.world.update(dt, this.speed, this.player, this.powerUpSystem);
    this.coins += collected.coins;

    if (collected.powerup) {
      this.powerUpSystem.activatePowerUp(collected.powerup, this);
      this.missions.track('powerups', 1);
      if (collected.powerup === 'jetpack') {
        this.missions.track('jetpack', 1);
      }
    }

    // Mission tracking
    if (collected.coins > 0) {
      this.missions.track('coins', collected.coins);
    }
    this.missions.track('distance', this.speed * dt);

    // Obstacle collision (skip if jetpack)
    if (!this.powerUpSystem.isJetpackActive()) {
      const hit = this.world.checkObstacleHit(this.player);
      if (hit) {
        const died = this.player.takeDamage();
        if (!died) {
          this.missions.track('dodged', 0); // reset streak
        } else {
          this.gameOver();
          return;
        }
      } else if (hit === null) {
        // Successfully passed an obstacle zone - track dodge
        // (This is approximate - we track dodge per frame when near obstacle zone and not hit)
      }
    }

    // Score calculation
    const mBonus = 1 + this.missions.getMultiplierBonus();
    const mult = this.scoreMultiplier * mBonus;
    this.score = Math.floor(this.distance * mult) + Math.floor(this.coins * 3 * mult);

    // Camera follows player x slightly
    this.camera.position.x = lerp(this.camera.position.x, this.player.x * 0.3, dt * 4);

    // HUD
    this.hud.update(
      this.score,
      this.coins,
      this.missions.getActiveMissions(),
      this.powerUpSystem.getActive(),
      this.player.hoverboard
    );

    // Safety check
    if (!this.player.isAlive) {
      this.gameOver();
    }
  }

  gameOver() {
    this.state = 'GAMEOVER';
    cancelAnimationFrame(this._raf);
    this.hud.hide();

    // High score
    const hs = parseInt(localStorage.getItem('highScore') || '0');
    const isNew = this.score > hs;
    if (isNew) {
      localStorage.setItem('highScore', this.score);
    }

    // Update gameover screen
    const finalScore = document.getElementById('final-score');
    if (finalScore) finalScore.textContent = this.score.toLocaleString();

    const finalCoins = document.getElementById('final-coins');
    if (finalCoins) finalCoins.textContent = this.coins.toLocaleString();

    const finalDist = document.getElementById('final-distance');
    if (finalDist) finalDist.textContent = Math.floor(this.distance) + 'm';

    const newHSEl = document.getElementById('new-highscore');
    if (newHSEl) newHSEl.style.display = isNew ? 'block' : 'none';

    const hsEl = document.getElementById('gameover-highscore');
    if (hsEl) hsEl.textContent = Math.max(this.score, hs).toLocaleString();

    this._showScreen('gameover-screen');
  }

  restart() {
    this.startGame();
  }

  goToMenu() {
    this.state = 'MENU';
    cancelAnimationFrame(this._raf);
    this.hud.hide();
    this._showScreen('menu-screen');
    this._updateMenuHighScore();
  }
}
