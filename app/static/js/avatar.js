import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const webApp = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (webApp) {
  webApp.ready();
  webApp.expand();
}

const avatarForm = document.getElementById('avatarForm');
const avatarTextInput = document.getElementById('avatarTextInput');
const avatarSubmitBtn = document.getElementById('avatarSubmitBtn');
const avatarStatus = document.getElementById('avatarStatus');
const animationQueue = document.getElementById('animationQueue');
const animationLog = document.getElementById('animationLog');
const avatarPreview = document.getElementById('avatarPreview');
const currentActionLabel = document.getElementById('currentActionText');
const playbackSpeedSelect = document.getElementById('playbackSpeedSelect');
const avatarHeroText = document.getElementById('avatarHeroText');
const avatarHeroMeta = document.getElementById('avatarHeroMeta');
const avatarModeBadge = document.getElementById('avatarModeBadge');
const avatarProgressText = document.getElementById('avatarProgressText');
const avatarCoachTitle = document.getElementById('avatarCoachTitle');
const avatarCoachSubtitle = document.getElementById('avatarCoachSubtitle');
const avatarAudienceHint = document.getElementById('avatarAudienceHint');
const avatarLeftHandCue = document.getElementById('avatarLeftHandCue');
const avatarRightHandCue = document.getElementById('avatarRightHandCue');

const DEFAULT_STEP_DURATION_MS = 1800;
const DEFAULT_CROSSFADE_SECONDS = 0.4;
const DEFAULT_MODEL_SCALE = 1.35;

let playbackSpeed = 1.0;
const assetAvailabilityCache = new Map();
const AVAILABLE_GLB_ASSETS = new Set(
  Array.isArray(window.AVATAR_GLB_ASSETS) ? window.AVATAR_GLB_ASSETS : []
);

const DEFAULT_GUIDANCE = {
  title: 'Fallback sign',
  subtitle: 'Readable placeholder sign motion.',
  badge: 'Fallback',
  audience_hint: 'This is a coached fallback pose to keep the motion understandable.',
  left_hand_cue: 'Left hand frames the body.',
  right_hand_cue: 'Right hand carries the main motion.'
};

const POSE_LIBRARY = {
  idle: {
    leftUpperZ: 0.86,
    leftUpperX: 0.02,
    leftUpperY: 0.03,
    leftForeZ: -0.58,
    leftForeX: 0.04,
    leftForeY: 0.04,
    rightUpperZ: -0.86,
    rightUpperX: 0.02,
    rightUpperY: -0.03,
    rightForeZ: 0.58,
    rightForeX: 0.04,
    rightForeY: -0.04,
    headY: 0,
    headX: 0,
    torsoY: 0,
    hipsY: 0,
    leftLegX: 0,
    rightLegX: 0,
    turnY: 0,
    bodyY: -0.14,
    headSwing: 0.08,
    motion: { type: 'idle' }
  },
  greet_wave: {
    leftUpperZ: 0.62, leftUpperX: 0.08, leftUpperY: 0.08,
    leftForeZ: -0.62, leftForeX: 0.06, leftForeY: 0.02,
    rightUpperZ: -1.3, rightUpperX: 0.3, rightUpperY: -0.12,
    rightForeZ: 0.28, rightForeX: -0.08, rightForeY: 0.2,
    headY: 0.12, headX: -0.04, torsoY: 0.08, hipsY: 0.04,
    leftLegX: -0.02, rightLegX: 0.02, turnY: 0.1, bodyY: -0.1, headSwing: 0.18,
    motion: { type: 'wave', hand: 'right', amplitude: 0.55, speed: 3.6 }
  },
  thanks_outward: {
    leftUpperZ: 0.56, leftUpperX: 0, leftUpperY: 0.04,
    leftForeZ: -0.58, leftForeX: 0.08, leftForeY: 0.02,
    rightUpperZ: -0.96, rightUpperX: 0.1, rightUpperY: -0.06,
    rightForeZ: 1.02, rightForeX: -0.22, rightForeY: 0.22,
    headY: -0.06, headX: 0.03, torsoY: -0.04, hipsY: -0.02,
    leftLegX: 0, rightLegX: 0, turnY: -0.02, bodyY: -0.12, headSwing: 0.1,
    motion: { type: 'outward_push', hand: 'right', amplitude: 0.25, speed: 2.4 }
  },
  help_forward: {
    leftUpperZ: 0.82, leftUpperX: -0.06, leftUpperY: 0.08,
    leftForeZ: -0.2, leftForeX: 0.18, leftForeY: 0.16,
    rightUpperZ: -0.82, rightUpperX: -0.06, rightUpperY: -0.08,
    rightForeZ: 0.2, rightForeX: 0.18, rightForeY: -0.16,
    headY: 0, headX: 0.02, torsoY: 0, hipsY: 0,
    leftLegX: -0.01, rightLegX: -0.01, turnY: 0, bodyY: -0.08, headSwing: 0.08,
    motion: { type: 'double_offer', amplitude: 0.18, speed: 2.1 }
  },
  confirm_yes: {
    leftUpperZ: 0.6, leftUpperX: 0.02, leftUpperY: 0.02,
    leftForeZ: -0.42, leftForeX: 0.08, leftForeY: 0,
    rightUpperZ: -0.74, rightUpperX: 0.18, rightUpperY: -0.08,
    rightForeZ: 0.36, rightForeX: 0.08, rightForeY: 0.08,
    headY: 0.02, headX: 0.12, torsoY: 0.02, hipsY: 0,
    leftLegX: 0, rightLegX: 0, turnY: 0.02, bodyY: -0.12, headSwing: 0.04,
    motion: { type: 'nod_yes', amplitude: 0.18, speed: 3.2 }
  },
  refuse_no: {
    leftUpperZ: 1.0, leftUpperX: -0.06, leftUpperY: 0.08,
    leftForeZ: -0.3, leftForeX: 0.14, leftForeY: -0.06,
    rightUpperZ: -1.0, rightUpperX: -0.06, rightUpperY: -0.08,
    rightForeZ: 0.3, rightForeX: 0.14, rightForeY: 0.06,
    headY: -0.18, headX: 0.03, torsoY: -0.08, hipsY: -0.04,
    leftLegX: 0.01, rightLegX: -0.01, turnY: -0.08, bodyY: -0.11, headSwing: 0.05,
    motion: { type: 'shake_no', amplitude: 0.28, speed: 3.5 }
  },
  goodbye_wave: {
    leftUpperZ: 0.42, leftUpperX: 0.02, leftUpperY: 0.04,
    leftForeZ: -0.52, leftForeX: 0.04, leftForeY: 0,
    rightUpperZ: -1.3, rightUpperX: 0.28, rightUpperY: -0.1,
    rightForeZ: 0.4, rightForeX: -0.06, rightForeY: 0.18,
    headY: 0.12, headX: -0.02, torsoY: 0.08, hipsY: 0.03,
    leftLegX: 0, rightLegX: 0, turnY: 0.1, bodyY: -0.12, headSwing: 0.16,
    motion: { type: 'wave', hand: 'right', amplitude: 0.65, speed: 3.0 }
  },
  self_reference: {
    leftUpperZ: 0.58, leftUpperX: 0.02, leftUpperY: 0.02,
    leftForeZ: -0.42, leftForeX: 0.08, leftForeY: 0,
    rightUpperZ: -0.86, rightUpperX: 0.02, rightUpperY: -0.04,
    rightForeZ: 0.92, rightForeX: 0.18, rightForeY: 0.05,
    headY: -0.05, headX: 0, torsoY: -0.05, hipsY: -0.02,
    leftLegX: 0, rightLegX: 0, turnY: -0.02, bodyY: -0.12, headSwing: 0.06,
    motion: { type: 'tap_chest', hand: 'right', amplitude: 0.18, speed: 2.8 }
  },
  point_you: {
    leftUpperZ: 0.5, leftUpperX: -0.02, leftUpperY: 0.03,
    leftForeZ: -0.48, leftForeX: 0.08, leftForeY: 0,
    rightUpperZ: -1.02, rightUpperX: -0.06, rightUpperY: -0.03,
    rightForeZ: 0.06, rightForeX: 0.06, rightForeY: 0.22,
    headY: -0.1, headX: 0.02, torsoY: -0.08, hipsY: -0.03,
    leftLegX: 0, rightLegX: 0, turnY: -0.06, bodyY: -0.12, headSwing: 0.06,
    motion: { type: 'point_forward', hand: 'right', amplitude: 0.18, speed: 2.6 }
  },
  point_respect: {
    leftUpperZ: 0.5, leftUpperX: 0, leftUpperY: 0.03,
    leftForeZ: -0.48, leftForeX: 0.06, leftForeY: 0,
    rightUpperZ: -0.96, rightUpperX: -0.02, rightUpperY: -0.02,
    rightForeZ: 0.14, rightForeX: 0.03, rightForeY: 0.14,
    headY: -0.04, headX: -0.02, torsoY: -0.03, hipsY: 0,
    leftLegX: 0, rightLegX: 0, turnY: -0.03, bodyY: -0.12, headSwing: 0.04,
    motion: { type: 'point_forward', hand: 'right', amplitude: 0.1, speed: 2.0 }
  },
  group_include: {
    leftUpperZ: 0.84, leftUpperX: -0.04, leftUpperY: 0.1,
    leftForeZ: -0.18, leftForeX: 0.12, leftForeY: 0.1,
    rightUpperZ: -0.84, rightUpperX: -0.04, rightUpperY: -0.1,
    rightForeZ: 0.18, rightForeX: 0.12, rightForeY: -0.1,
    headY: 0, headX: 0, torsoY: 0, hipsY: 0,
    leftLegX: -0.01, rightLegX: -0.01, turnY: 0, bodyY: -0.09, headSwing: 0.06,
    motion: { type: 'include_group', amplitude: 0.16, speed: 2.0 }
  },
  today_mark: {
    leftUpperZ: 0.7, leftUpperX: 0.02, leftUpperY: 0.08,
    leftForeZ: -0.8, leftForeX: 0.12, leftForeY: 0.1,
    rightUpperZ: -0.7, rightUpperX: 0.02, rightUpperY: -0.08,
    rightForeZ: 0.8, rightForeX: 0.12, rightForeY: -0.1,
    headY: 0.02, headX: -0.01, torsoY: 0.03, hipsY: 0.02,
    leftLegX: 0, rightLegX: 0, turnY: 0.02, bodyY: -0.12, headSwing: 0.05,
    motion: { type: 'mark_center', amplitude: 0.14, speed: 2.4 }
  },
  letter_a: {
    leftUpperZ: 1.12, leftUpperX: 0.08, leftUpperY: 0.06,
    leftForeZ: -0.24, leftForeX: 0.16, leftForeY: 0.06,
    rightUpperZ: -0.44, rightUpperX: -0.08, rightUpperY: -0.02,
    rightForeZ: -0.54, rightForeX: 0.18, rightForeY: 0.02,
    headY: 0.08, headX: -0.02, torsoY: 0.06, hipsY: 0.02,
    leftLegX: 0, rightLegX: 0, turnY: 0.05, bodyY: -0.14, headSwing: 0.04,
    motion: { type: 'spell_hold', hand: 'left', amplitude: 0.06, speed: 2.0 }
  },
  letter_e: {
    leftUpperZ: 0.58, leftUpperX: -0.04, leftUpperY: 0.08,
    leftForeZ: -1.08, leftForeX: 0.08, leftForeY: 0.04,
    rightUpperZ: -1.12, rightUpperX: 0.15, rightUpperY: -0.05,
    rightForeZ: 0.2, rightForeX: -0.08, rightForeY: 0.02,
    headY: -0.06, headX: 0.02, torsoY: -0.08, hipsY: -0.02,
    leftLegX: 0, rightLegX: 0, turnY: -0.05, bodyY: -0.15, headSwing: 0.05,
    motion: { type: 'spell_hold', hand: 'left', amplitude: 0.06, speed: 2.2 }
  },
  letter_i: {
    leftUpperZ: 1.32, leftUpperX: 0.02, leftUpperY: 0.04,
    leftForeZ: 0.08, leftForeX: -0.05, leftForeY: 0,
    rightUpperZ: -0.9, rightUpperX: 0.04, rightUpperY: -0.02,
    rightForeZ: -0.4, rightForeX: -0.02, rightForeY: 0,
    headY: 0.12, headX: 0, torsoY: 0.08, hipsY: 0.02,
    leftLegX: 0, rightLegX: 0, turnY: 0.08, bodyY: -0.14, headSwing: 0.04,
    motion: { type: 'spell_hold', hand: 'left', amplitude: 0.05, speed: 2.0 }
  },
  letter_l: {
    leftUpperZ: 0.92, leftUpperX: 0.04, leftUpperY: 0.05,
    leftForeZ: -0.58, leftForeX: 0.02, leftForeY: 0.03,
    rightUpperZ: -0.92, rightUpperX: 0.04, rightUpperY: -0.05,
    rightForeZ: 0.58, rightForeX: 0.02, rightForeY: -0.03,
    headY: 0, headX: 0, torsoY: 0, hipsY: 0,
    leftLegX: 0, rightLegX: 0, turnY: 0, bodyY: -0.16, headSwing: 0.03,
    motion: { type: 'spell_hold', hand: 'both', amplitude: 0.05, speed: 1.8 }
  },
  letter_o: {
    leftUpperZ: 0.76, leftUpperX: 0.08, leftUpperY: 0.04,
    leftForeZ: -0.82, leftForeX: 0.16, leftForeY: 0.1,
    rightUpperZ: -0.76, rightUpperX: 0.08, rightUpperY: -0.04,
    rightForeZ: 0.82, rightForeX: 0.16, rightForeY: -0.1,
    headY: 0, headX: 0.02, torsoY: 0, hipsY: 0,
    leftLegX: 0, rightLegX: 0, turnY: 0, bodyY: -0.18, headSwing: 0.03,
    motion: { type: 'spell_hold', hand: 'both', amplitude: 0.05, speed: 1.8 }
  },
  letter_r: {
    leftUpperZ: 0.42, leftUpperX: 0.02, leftUpperY: 0.05,
    leftForeZ: -0.9, leftForeX: 0.12, leftForeY: 0.08,
    rightUpperZ: -1.18, rightUpperX: 0.12, rightUpperY: -0.05,
    rightForeZ: 0.02, rightForeX: -0.14, rightForeY: 0.2,
    headY: -0.12, headX: 0.03, torsoY: -0.1, hipsY: -0.03,
    leftLegX: 0, rightLegX: 0, turnY: -0.08, bodyY: -0.15, headSwing: 0.05,
    motion: { type: 'point_forward', hand: 'right', amplitude: 0.12, speed: 2.2 }
  },
  letter_s: {
    leftUpperZ: 1.16, leftUpperX: -0.06, leftUpperY: 0.08,
    leftForeZ: 0.18, leftForeX: 0.16, leftForeY: 0.02,
    rightUpperZ: -0.28, rightUpperX: 0.08, rightUpperY: -0.04,
    rightForeZ: -1.02, rightForeX: 0.08, rightForeY: 0.02,
    headY: 0.18, headX: -0.03, torsoY: 0.12, hipsY: 0.04,
    leftLegX: 0, rightLegX: 0, turnY: 0.14, bodyY: -0.14, headSwing: 0.05,
    motion: { type: 'spell_hold', hand: 'left', amplitude: 0.08, speed: 2.3 }
  },
  letter_t: {
    leftUpperZ: 0.3, leftUpperX: -0.08, leftUpperY: 0.04,
    leftForeZ: -0.98, leftForeX: 0.16, leftForeY: 0.08,
    rightUpperZ: -1.24, rightUpperX: 0.02, rightUpperY: -0.05,
    rightForeZ: -0.04, rightForeX: 0.08, rightForeY: 0.16,
    headY: -0.2, headX: 0, torsoY: -0.12, hipsY: -0.03,
    leftLegX: 0, rightLegX: 0, turnY: -0.14, bodyY: -0.14, headSwing: 0.05,
    motion: { type: 'spell_hold', hand: 'right', amplitude: 0.08, speed: 2.3 }
  },
  letter_generic: {
    leftUpperZ: 0.84, leftUpperX: 0, leftUpperY: 0.04,
    leftForeZ: -0.58, leftForeX: 0.08, leftForeY: 0.04,
    rightUpperZ: -0.84, rightUpperX: 0, rightUpperY: -0.04,
    rightForeZ: 0.58, rightForeX: 0.08, rightForeY: -0.04,
    headY: 0, headX: 0, torsoY: 0, hipsY: 0,
    leftLegX: 0, rightLegX: 0, turnY: 0, bodyY: -0.16, headSwing: 0.04,
    motion: { type: 'spell_hold', hand: 'right', amplitude: 0.05, speed: 1.9 }
  }
};

function resolvePose(step) {
  return POSE_LIBRARY[step.pose] || POSE_LIBRARY.letter_generic;
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function setPlaybackSpeed(value) {
  const parsed = Number.parseFloat(value);
  playbackSpeed = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  if (playbackSpeedSelect) {
    playbackSpeedSelect.value = String(playbackSpeed);
  }
}

function setAvatarStatus(message) {
  if (avatarStatus) {
    avatarStatus.textContent = message;
  }
}

function setCurrentAction(value) {
  if (currentActionLabel) {
    currentActionLabel.textContent = `Current action: ${value}`;
  }
}

function setHero(title, meta, badge) {
  if (avatarHeroText) {
    avatarHeroText.textContent = title;
  }
  if (avatarHeroMeta) {
    avatarHeroMeta.textContent = meta;
  }
  if (avatarModeBadge) {
    avatarModeBadge.textContent = badge;
  }
}

function setCoach(guidance = DEFAULT_GUIDANCE) {
  if (avatarCoachTitle) {
    avatarCoachTitle.textContent = guidance.title || DEFAULT_GUIDANCE.title;
  }
  if (avatarCoachSubtitle) {
    avatarCoachSubtitle.textContent = guidance.subtitle || DEFAULT_GUIDANCE.subtitle;
  }
  if (avatarAudienceHint) {
    avatarAudienceHint.textContent = guidance.audience_hint || DEFAULT_GUIDANCE.audience_hint;
  }
  if (avatarLeftHandCue) {
    avatarLeftHandCue.textContent = guidance.left_hand_cue || DEFAULT_GUIDANCE.left_hand_cue;
  }
  if (avatarRightHandCue) {
    avatarRightHandCue.textContent = guidance.right_hand_cue || DEFAULT_GUIDANCE.right_hand_cue;
  }
}

function setProgress(current, total) {
  if (avatarProgressText) {
    avatarProgressText.textContent = `Step ${current} of ${total}`;
  }
}

function setAnimationLog(message) {
  if (!animationLog) {
    return;
  }
  animationLog.textContent = Array.isArray(message) ? message.join('\n') : String(message || '');
}

function renderAnimationQueue(items, activeIndex = -1) {
  if (!animationQueue) {
    return;
  }

  if (!Array.isArray(items) || !items.length) {
    animationQueue.innerHTML = '<span class="chip">No animations queued</span>';
    return;
  }

  animationQueue.innerHTML = items.map((item, index) => {
    const token = item.display || item.token || `Step ${index + 1}`;
    const classes = ['chip'];
    if (index === activeIndex) {
      classes.push('active');
    }
    return `<span class="${classes.join(' ')}">${token}</span>`;
  }).join('');
}

class AvatarRig {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = null;
    this.controls = null;
    this.loader = new GLTFLoader();
    this.currentMixer = null;
    this.currentModel = null;
    this.currentAction = null;
    this.currentClipPath = null;
    this.currentModelBaseScale = DEFAULT_MODEL_SCALE;
    this.pendingCrossfade = null;
    this.fallbackGroup = null;
    this.fallbackPose = POSE_LIBRARY.idle;
    this.fallbackStartTime = performance.now();
    this.leftTrail = [];
    this.rightTrail = [];
    this.morphTargets = [];
    this.blinkState = {
      active: false,
      startAt: performance.now(),
      nextAt: performance.now() + this.randomBetween(3000, 6000),
      duration: 180
    };
    this.speakingState = {
      active: false,
      token: '',
      startAt: performance.now(),
      strength: 0
    };
  }

  randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  init() {
    if (!this.container || this.renderer) {
      return;
    }

    const width = this.container.clientWidth || 420;
    const height = this.container.clientHeight || 420;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(27, width / height, 0.1, 100);
    this.camera.position.set(0, 1.8, 5.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    const hemi = new THREE.HemisphereLight(0xf8fbff, 0x0f172a, 1.2);
    hemi.position.set(0, 6, 0);

    const key = new THREE.DirectionalLight(0xffffff, 2.3);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.width = 1024;
    key.shadow.mapSize.height = 1024;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 20;
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;

    const fill = new THREE.DirectionalLight(0x93c5fd, 1.25);
    fill.position.set(-2.5, 2.8, 2.2);

    this.scene.add(hemi, key, fill);

    const stage = new THREE.Mesh(
      new THREE.CircleGeometry(1.95, 64),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.16, roughness: 0.9, metalness: 0 })
    );
    stage.rotation.x = -Math.PI / 2;
    stage.position.y = -1.45;
    stage.receiveShadow = true;
    this.scene.add(stage);

    this.fallbackGroup = this.createFallbackAvatar();
    this.scene.add(this.fallbackGroup);
    this.createHandTrails();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.minPolarAngle = 0.98;
    this.controls.maxPolarAngle = 1.62;
    this.controls.target.set(0, 0.7, 0);
    this.controls.update();

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  createMaterial(color) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 });
  }

  createLimb(length, radius, color) {
    return new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, length, 8, 18),
      this.createMaterial(color)
    );
  }

  createHand(color) {
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.22, 0.08),
      this.createMaterial(color)
    );
    hand.add(palm);

    for (let index = 0; index < 4; index += 1) {
      const finger = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.022, 0.12, 4, 8),
        this.createMaterial(color)
      );
      finger.position.set(-0.06 + index * 0.04, 0.14, 0);
      finger.rotation.z = 0.12 - index * 0.04;
      hand.add(finger);
    }

    const thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.024, 0.1, 4, 8),
      this.createMaterial(color)
    );
    thumb.position.set(0.11, 0.02, 0);
    thumb.rotation.z = -0.85;
    hand.add(thumb);

    return hand;
  }

  createEye(offsetX) {
    const eye = new THREE.Group();
    const eyeball = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 18, 18),
      this.createMaterial(0xffffff)
    );
    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 12, 12),
      this.createMaterial(0x0f172a)
    );
    pupil.position.z = 0.045;
    eye.position.set(offsetX, 1.46, 0.31);
    eye.add(eyeball, pupil);
    return eye;
  }

  createFallbackAvatar() {
    const group = new THREE.Group();

    const hips = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 0.3, 8, 16),
      this.createMaterial(0x4679bf)
    );
    hips.position.y = -0.55;

    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.5, 1.4, 10, 20),
      this.createMaterial(0x5b93d9)
    );
    torso.position.y = 0.15;

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.11, 0.18, 18),
      this.createMaterial(0xdbeafe)
    );
    neck.position.y = 1.18;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.37, 36, 36),
      this.createMaterial(0xe2e8f0)
    );
    head.position.set(0, 1.5, 0.02);

    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.08, 0.01, 8, 24, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0 })
    );
    mouth.rotation.x = Math.PI / 2;
    mouth.position.set(0, 1.33, 0.31);

    const leftEye = this.createEye(-0.12);
    const rightEye = this.createEye(0.12);

    const shoulderBar = new THREE.Group();
    shoulderBar.position.set(0, 0.82, 0);

    const leftUpperArmPivot = new THREE.Group();
    leftUpperArmPivot.position.set(-0.54, 0.05, 0);
    const leftUpperArm = this.createLimb(0.54, 0.1, 0x9ec5f8);
    leftUpperArm.rotation.z = -Math.PI / 2;
    leftUpperArm.position.x = -0.27;
    leftUpperArmPivot.add(leftUpperArm);

    const leftForearmPivot = new THREE.Group();
    leftForearmPivot.position.set(-0.54, 0, 0);
    const leftForearm = this.createLimb(0.48, 0.085, 0xc4ddff);
    leftForearm.rotation.z = -Math.PI / 2;
    leftForearm.position.x = -0.24;
    leftForearmPivot.add(leftForearm);
    leftUpperArmPivot.add(leftForearmPivot);

    const leftHand = this.createHand(0xe2e8f0);
    leftHand.position.set(-0.46, 0, 0);
    leftForearmPivot.add(leftHand);

    const rightUpperArmPivot = new THREE.Group();
    rightUpperArmPivot.position.set(0.54, 0.05, 0);
    const rightUpperArm = this.createLimb(0.54, 0.1, 0x9ec5f8);
    rightUpperArm.rotation.z = Math.PI / 2;
    rightUpperArm.position.x = 0.27;
    rightUpperArmPivot.add(rightUpperArm);

    const rightForearmPivot = new THREE.Group();
    rightForearmPivot.position.set(0.54, 0, 0);
    const rightForearm = this.createLimb(0.48, 0.085, 0xc4ddff);
    rightForearm.rotation.z = Math.PI / 2;
    rightForearm.position.x = 0.24;
    rightForearmPivot.add(rightForearm);
    rightUpperArmPivot.add(rightForearmPivot);

    const rightHand = this.createHand(0xe2e8f0);
    rightHand.position.set(0.46, 0, 0);
    rightForearmPivot.add(rightHand);

    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.22, -0.85, 0);
    const leftLeg = this.createLimb(0.9, 0.12, 0x3f6daa);
    leftLeg.position.y = -0.45;
    leftLegPivot.add(leftLeg);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.22, -0.85, 0);
    const rightLeg = this.createLimb(0.9, 0.12, 0x3f6daa);
    rightLeg.position.y = -0.45;
    rightLegPivot.add(rightLeg);

    shoulderBar.add(leftUpperArmPivot, rightUpperArmPivot);
    group.add(hips, torso, neck, head, mouth, leftEye, rightEye, shoulderBar, leftLegPivot, rightLegPivot);
    group.userData = {
      head,
      torso,
      hips,
      mouth,
      leftEye,
      rightEye,
      leftUpperArmPivot,
      leftForearmPivot,
      rightUpperArmPivot,
      rightForearmPivot,
      leftHand,
      rightHand,
      leftLegPivot,
      rightLegPivot
    };
    group.position.y = -0.1;

    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return group;
  }

  createTrail(color) {
    const trail = [];
    for (let index = 0; index < 8; index += 1) {
      const point = new THREE.Mesh(
        new THREE.SphereGeometry(0.035 - index * 0.003, 10, 10),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 - index * 0.03 })
      );
      point.visible = false;
      this.scene.add(point);
      trail.push(point);
    }
    return trail;
  }

  createHandTrails() {
    this.leftTrail = this.createTrail(0x93c5fd);
    this.rightTrail = this.createTrail(0xf8fafc);
  }

  updateTrail(trail, source) {
    if (!source || !trail.length) {
      return;
    }

    const worldPosition = new THREE.Vector3();
    source.getWorldPosition(worldPosition);

    for (let index = trail.length - 1; index > 0; index -= 1) {
      trail[index].position.copy(trail[index - 1].position);
      trail[index].visible = trail[index - 1].visible;
    }

    trail[0].position.copy(worldPosition);
    trail[0].visible = true;
  }

  showFallback() {
    if (!this.fallbackGroup) {
      return;
    }
    this.fallbackGroup.visible = true;
    [...this.leftTrail, ...this.rightTrail].forEach((point) => {
      point.visible = false;
    });
  }

  hideFallback() {
    if (!this.fallbackGroup) {
      return;
    }
    this.fallbackGroup.visible = false;
    [...this.leftTrail, ...this.rightTrail].forEach((point) => {
      point.visible = false;
    });
  }

  onResize() {
    if (!this.renderer || !this.camera || !this.container) {
      return;
    }

    const width = this.container.clientWidth || 420;
    const height = this.container.clientHeight || 420;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  startSpeaking(token) {
    this.speakingState = {
      active: true,
      token: String(token || '').toLowerCase(),
      startAt: performance.now(),
      strength: 0.18 + Math.min(String(token || '').length, 8) * 0.03
    };
  }

  stopSpeaking() {
    this.speakingState.active = false;
    this.speakingState.token = '';
    this.speakingState.strength = 0;
  }

  scheduleNextBlink(now) {
    this.blinkState.nextAt = now + this.randomBetween(3000, 6000);
  }

  applyMaterialTuning(material) {
    if (!material) {
      return;
    }
    material.roughness = 0.6;
    material.metalness = 0;
    material.needsUpdate = true;
  }

  findMorphIndices(dictionary, candidates) {
    const entries = Object.entries(dictionary || {}).map(([key, value]) => [normalizeName(key), value]);
    const indices = [];

    candidates.forEach((candidate) => {
      const normalizedCandidate = normalizeName(candidate);
      const found = entries.find(([key]) => key.includes(normalizedCandidate));
      if (found) {
        indices.push(found[1]);
      }
    });

    return [...new Set(indices)];
  }

  registerMorphTargets(root) {
    this.morphTargets = [];

    root.traverse((child) => {
      if (!child.isMesh && !child.isSkinnedMesh) {
        return;
      }

      child.castShadow = true;
      child.receiveShadow = true;

      if (Array.isArray(child.material)) {
        child.material.forEach((material) => this.applyMaterialTuning(material));
      } else {
        this.applyMaterialTuning(child.material);
      }

      if (!child.morphTargetDictionary || !child.morphTargetInfluences) {
        return;
      }

      this.morphTargets.push({
        influences: child.morphTargetInfluences,
        blinkLeft: this.findMorphIndices(child.morphTargetDictionary, ['eyeBlink_L', 'blink_l', 'blinkleft']),
        blinkRight: this.findMorphIndices(child.morphTargetDictionary, ['eyeBlink_R', 'blink_r', 'blinkright']),
        jawOpen: this.findMorphIndices(child.morphTargetDictionary, ['jawOpen', 'mouthOpen']),
        smile: this.findMorphIndices(child.morphTargetDictionary, ['smile', 'mouthSmile']),
        visemeA: this.findMorphIndices(child.morphTargetDictionary, ['viseme_aa', 'viseme_ah', 'mouthA']),
        visemeE: this.findMorphIndices(child.morphTargetDictionary, ['viseme_e', 'viseme_ee', 'mouthE']),
        visemeO: this.findMorphIndices(child.morphTargetDictionary, ['viseme_o', 'viseme_oo', 'mouthO'])
      });
    });
  }

  clearMorphTargets() {
    this.morphTargets = [];
  }

  applyMorphValue(indices, entry, target, alpha = 0.18) {
    indices.forEach((index) => {
      entry.influences[index] += (target - entry.influences[index]) * alpha;
    });
  }

  updateBlink(now) {
    if (!this.blinkState.active && now >= this.blinkState.nextAt) {
      this.blinkState.active = true;
      this.blinkState.startAt = now;
    }

    let blinkValue = 0;
    if (this.blinkState.active) {
      const phase = Math.min((now - this.blinkState.startAt) / this.blinkState.duration, 1);
      blinkValue = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      if (phase >= 1) {
        this.blinkState.active = false;
        this.scheduleNextBlink(now);
      }
    }

    if (this.fallbackGroup) {
      const eyeScale = Math.max(0.08, 1 - blinkValue * 0.92);
      this.fallbackGroup.userData.leftEye.scale.y = eyeScale;
      this.fallbackGroup.userData.rightEye.scale.y = eyeScale;
    }

    this.morphTargets.forEach((entry) => {
      this.applyMorphValue(entry.blinkLeft, entry, blinkValue, 0.3);
      this.applyMorphValue(entry.blinkRight, entry, blinkValue, 0.3);
    });
  }

  updateBreathing(now) {
    const breath = Math.sin(now * 0.0012) * 0.018;

    if (this.fallbackGroup) {
      const { torso, hips } = this.fallbackGroup.userData;
      torso.scale.y += ((1 + breath * 0.9) - torso.scale.y) * 0.08;
      torso.scale.z += ((1 + breath * 0.6) - torso.scale.z) * 0.08;
      hips.scale.y += ((1 + breath * 0.2) - hips.scale.y) * 0.08;
    }

    if (this.currentModel) {
      const targetScale = this.currentModelBaseScale * (1 + breath * 0.1);
      const currentScale = this.currentModel.scale.x || this.currentModelBaseScale;
      const nextScale = currentScale + (targetScale - currentScale) * 0.06;
      this.currentModel.scale.setScalar(nextScale);
    }
  }

  updateSpeechMorphs(now) {
    const phase = (now - this.speakingState.startAt) * 0.012 * playbackSpeed;
    const token = this.speakingState.token;
    const active = this.speakingState.active;
    const jawTarget = active ? 0.08 + ((Math.sin(phase) + 1) * 0.5) * this.speakingState.strength : 0;
    const smileTarget = active && ['salom', 'rahmat', 'xayr'].includes(token) ? 0.18 : 0.02;
    const visemeATarget = active && token.includes('a') ? 0.4 : 0;
    const visemeETarget = active && (token.includes('e') || token.includes('i')) ? 0.32 : 0;
    const visemeOTarget = active && (token.includes('o') || token.includes('u')) ? 0.35 : 0;

    if (this.fallbackGroup) {
      const mouth = this.fallbackGroup.userData.mouth;
      mouth.scale.x += ((1 + smileTarget * 0.5) - mouth.scale.x) * 0.12;
      mouth.scale.y += ((1 + jawTarget * 1.6) - mouth.scale.y) * 0.12;
    }

    this.morphTargets.forEach((entry) => {
      this.applyMorphValue(entry.jawOpen, entry, jawTarget);
      this.applyMorphValue(entry.smile, entry, smileTarget);
      this.applyMorphValue(entry.visemeA, entry, visemeATarget);
      this.applyMorphValue(entry.visemeE, entry, visemeETarget);
      this.applyMorphValue(entry.visemeO, entry, visemeOTarget);
    });
  }

  applyMotionOverlay(nodes, pose, elapsed) {
    const motion = pose.motion || { type: 'idle' };
    const sine = Math.sin(elapsed * (motion.speed || 2));

    switch (motion.type) {
      case 'wave':
        if (motion.hand === 'right') {
          nodes.rightForearmPivot.rotation.y += sine * motion.amplitude;
        } else {
          nodes.leftForearmPivot.rotation.y += sine * motion.amplitude;
        }
        break;
      case 'outward_push':
        nodes.rightForearmPivot.rotation.x += Math.max(0, sine) * motion.amplitude;
        break;
      case 'double_offer':
        nodes.leftForearmPivot.rotation.x += Math.max(0, sine) * motion.amplitude;
        nodes.rightForearmPivot.rotation.x += Math.max(0, sine) * motion.amplitude;
        break;
      case 'nod_yes':
        nodes.head.rotation.x += Math.abs(sine) * motion.amplitude;
        break;
      case 'shake_no':
        nodes.head.rotation.y += sine * motion.amplitude;
        break;
      case 'tap_chest':
        nodes.rightForearmPivot.rotation.x += Math.max(0, sine) * motion.amplitude;
        break;
      case 'point_forward':
        if (motion.hand === 'right') {
          nodes.rightForearmPivot.rotation.x += Math.max(0, sine) * motion.amplitude;
        }
        break;
      case 'include_group':
        nodes.leftForearmPivot.rotation.y += Math.max(0, sine) * motion.amplitude;
        nodes.rightForearmPivot.rotation.y -= Math.max(0, sine) * motion.amplitude;
        break;
      case 'mark_center':
        nodes.leftForearmPivot.rotation.x += sine * motion.amplitude;
        nodes.rightForearmPivot.rotation.x -= sine * motion.amplitude;
        break;
      case 'spell_hold':
        if (motion.hand === 'left' || motion.hand === 'both') {
          nodes.leftHand.rotation.z = sine * motion.amplitude;
        }
        if (motion.hand === 'right' || motion.hand === 'both') {
          nodes.rightHand.rotation.z = -sine * motion.amplitude;
        }
        break;
      default:
        break;
    }
  }

  updateFallbackMotion(now) {
    if (!this.fallbackGroup || !this.fallbackPose) {
      return;
    }

    const nodes = this.fallbackGroup.userData;
    const elapsed = (now - this.fallbackStartTime) * 0.0024 * playbackSpeed;
    const pulse = Math.sin(elapsed * 3.2) * 0.06;
    const sway = Math.sin(elapsed * 0.9) * 0.04;

    nodes.leftUpperArmPivot.rotation.z += (this.fallbackPose.leftUpperZ - nodes.leftUpperArmPivot.rotation.z) * 0.12;
    nodes.leftUpperArmPivot.rotation.x += (this.fallbackPose.leftUpperX - nodes.leftUpperArmPivot.rotation.x) * 0.12;
    nodes.leftUpperArmPivot.rotation.y += (this.fallbackPose.leftUpperY - nodes.leftUpperArmPivot.rotation.y) * 0.12;
    nodes.leftForearmPivot.rotation.z += (this.fallbackPose.leftForeZ + pulse * 0.2 - nodes.leftForearmPivot.rotation.z) * 0.12;
    nodes.leftForearmPivot.rotation.x += (this.fallbackPose.leftForeX - nodes.leftForearmPivot.rotation.x) * 0.12;
    nodes.leftForearmPivot.rotation.y += (this.fallbackPose.leftForeY - nodes.leftForearmPivot.rotation.y) * 0.12;

    nodes.rightUpperArmPivot.rotation.z += (this.fallbackPose.rightUpperZ - nodes.rightUpperArmPivot.rotation.z) * 0.12;
    nodes.rightUpperArmPivot.rotation.x += (this.fallbackPose.rightUpperX - nodes.rightUpperArmPivot.rotation.x) * 0.12;
    nodes.rightUpperArmPivot.rotation.y += (this.fallbackPose.rightUpperY - nodes.rightUpperArmPivot.rotation.y) * 0.12;
    nodes.rightForearmPivot.rotation.z += (this.fallbackPose.rightForeZ - pulse * 0.2 - nodes.rightForearmPivot.rotation.z) * 0.12;
    nodes.rightForearmPivot.rotation.x += (this.fallbackPose.rightForeX - nodes.rightForearmPivot.rotation.x) * 0.12;
    nodes.rightForearmPivot.rotation.y += (this.fallbackPose.rightForeY - nodes.rightForearmPivot.rotation.y) * 0.12;

    nodes.head.rotation.y += (this.fallbackPose.headY + sway * this.fallbackPose.headSwing - nodes.head.rotation.y) * 0.1;
    nodes.head.rotation.x += (this.fallbackPose.headX - nodes.head.rotation.x) * 0.1;
    nodes.torso.rotation.y += (this.fallbackPose.torsoY - nodes.torso.rotation.y) * 0.1;
    nodes.hips.rotation.y += (this.fallbackPose.hipsY - nodes.hips.rotation.y) * 0.08;
    nodes.leftLegPivot.rotation.x += (this.fallbackPose.leftLegX - nodes.leftLegPivot.rotation.x) * 0.08;
    nodes.rightLegPivot.rotation.x += (this.fallbackPose.rightLegX - nodes.rightLegPivot.rotation.x) * 0.08;

    this.fallbackGroup.position.y += (this.fallbackPose.bodyY - this.fallbackGroup.position.y) * 0.1;
    this.fallbackGroup.rotation.y += (this.fallbackPose.turnY - this.fallbackGroup.rotation.y) * 0.08;

    nodes.leftHand.rotation.z = 0;
    nodes.rightHand.rotation.z = 0;
    this.applyMotionOverlay(nodes, this.fallbackPose, elapsed);

    this.updateTrail(this.leftTrail, nodes.leftHand);
    this.updateTrail(this.rightTrail, nodes.rightHand);
  }

  animate = () => {
    requestAnimationFrame(this.animate);

    const now = performance.now();
    const delta = this.clock ? this.clock.getDelta() : 0.016;

    this.updateBlink(now);
    this.updateBreathing(now);
    this.updateSpeechMorphs(now);

    if (this.currentMixer) {
      this.currentMixer.update(delta);
    } else {
      this.updateFallbackMotion(now);
    }

    this.controls?.update();
    this.renderer?.render(this.scene, this.camera);
  };

  playFallbackStep(step) {
    this.clearCurrentModel();
    this.showFallback();
    this.currentClipPath = step.path;
    this.fallbackPose = resolvePose(step);
    this.fallbackStartTime = performance.now();
    this.startSpeaking(step.display || step.token);
  }

  clearCurrentModel() {
    if (this.currentAction) {
      this.currentAction.stop();
    }
    if (this.currentMixer) {
      this.currentMixer.stopAllAction();
    }

    if (this.currentModel) {
      this.scene.remove(this.currentModel);
    }

    this.currentMixer = null;
    this.currentModel = null;
    this.currentAction = null;
    this.clearMorphTargets();
  }

  async hasClipAsset(path) {
    if (!path) {
      return false;
    }
    if (assetAvailabilityCache.has(path)) {
      return assetAvailabilityCache.get(path);
    }

    const exists = AVAILABLE_GLB_ASSETS.has(path);
    assetAvailabilityCache.set(path, exists);
    return exists;
  }

  async loadClip(path) {
    this.init();
    this.currentClipPath = path;

    const exists = await this.hasClipAsset(path);
    if (!exists) {
      return null;
    }

    try {
      return await this.loader.loadAsync(path);
    } catch (error) {
      console.warn('GLB load failed, fallback avatar will stay visible:', path, error);
      assetAvailabilityCache.set(path, false);
      return null;
    }
  }

  async startStep(step, options = {}) {
    const gltf = await this.loadClip(step.path);
    const speed = options.playbackSpeed || playbackSpeed;

    if (!gltf) {
      this.playFallbackStep(step);
      return;
    }

    this.clearCurrentModel();
    this.currentModel = gltf.scene;
    this.currentModelBaseScale = DEFAULT_MODEL_SCALE;
    this.currentModel.position.set(0, -1.05, 0);
    this.currentModel.scale.setScalar(this.currentModelBaseScale);
    this.registerMorphTargets(this.currentModel);
    this.scene.add(this.currentModel);
    this.hideFallback();
    this.startSpeaking(step.display || step.token);

    if (gltf.animations && gltf.animations.length) {
      this.currentMixer = new THREE.AnimationMixer(this.currentModel);
      this.currentAction = this.currentMixer.clipAction(gltf.animations[0]);
      this.currentAction.reset();
      this.currentAction.enabled = true;
      this.currentAction.setLoop(THREE.LoopRepeat);
      this.currentAction.timeScale = speed;
      this.currentAction.fadeIn(options.crossfadeSeconds || DEFAULT_CROSSFADE_SECONDS);
      this.currentAction.play();
    }
  }

  async crossfadeToStep(step, crossfadeSeconds, options = {}) {
    if (!step || this.pendingCrossfade === step.path || this.currentClipPath === step.path) {
      return;
    }

    this.pendingCrossfade = step.path;

    const previousAction = this.currentAction;
    const previousModel = this.currentModel;
    const previousMixer = this.currentMixer;
    const gltf = await this.loadClip(step.path);

    this.pendingCrossfade = null;
    if (!gltf) {
      previousAction?.fadeOut(crossfadeSeconds);
      this.playFallbackStep(step);
      return;
    }

    const nextModel = gltf.scene;
    nextModel.position.set(0, -1.05, 0);
    nextModel.scale.setScalar(DEFAULT_MODEL_SCALE);
    this.registerMorphTargets(nextModel);
    this.scene.add(nextModel);
    this.hideFallback();
    this.startSpeaking(step.display || step.token);

    let nextMixer = null;
    let nextAction = null;

    if (gltf.animations && gltf.animations.length) {
      nextMixer = new THREE.AnimationMixer(nextModel);
      nextAction = nextMixer.clipAction(gltf.animations[0]);
      nextAction.reset();
      nextAction.enabled = true;
      nextAction.setLoop(THREE.LoopRepeat);
      nextAction.timeScale = options.playbackSpeed || playbackSpeed;
      nextAction.play();

      if (previousAction) {
        previousAction.crossFadeTo(nextAction, crossfadeSeconds, false);
      } else {
        nextAction.fadeIn(crossfadeSeconds);
      }
    }

    window.setTimeout(() => {
      if (previousModel) {
        this.scene.remove(previousModel);
      }
      if (previousMixer && previousMixer !== nextMixer) {
        previousMixer.stopAllAction();
      }
    }, crossfadeSeconds * 1000 + 80);

    this.currentModel = nextModel;
    this.currentModelBaseScale = DEFAULT_MODEL_SCALE;
    this.currentMixer = nextMixer;
    this.currentAction = nextAction;
    this.currentClipPath = step.path;
  }
}

class AnimationQueuePlayer {
  constructor(rig) {
    this.rig = rig;
    this.queue = [];
    this.isPlaying = false;
    this.activeTimeouts = new Set();
    this.crossfadeSeconds = DEFAULT_CROSSFADE_SECONDS;
  }

  clearTimers() {
    this.activeTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.activeTimeouts.clear();
  }

  reset() {
    this.clearTimers();
    this.queue = [];
    this.isPlaying = false;
    renderAnimationQueue([]);
    setCurrentAction('idle');
    setAvatarStatus('Animation queue is idle.');
    setHero('Waiting...', 'Enter text to start the avatar.', 'Idle');
    setCoach(DEFAULT_GUIDANCE);
    setProgress(0, 0);
    setAnimationLog('Waiting for text input...');
    this.rig.stopSpeaking();
  }

  enqueue(items) {
    if (!Array.isArray(items) || !items.length) {
      renderAnimationQueue(this.queue, -1);
      return;
    }
    this.queue.push(...items);
    renderAnimationQueue(this.queue, -1);
  }

  async play() {
    if (this.isPlaying || !this.queue.length) {
      return;
    }

    this.isPlaying = true;
    setAvatarStatus(`Queued ${this.queue.length} animation step(s).`);
    setHero('Queue ready', `The avatar will sign ${this.queue.length} step(s).`, 'Queued');

    for (let index = 0; index < this.queue.length; index += 1) {
      const step = this.queue[index];
      const nextStep = this.queue[index + 1] || null;
      const stepDuration = Math.max(900, (step.duration_ms || DEFAULT_STEP_DURATION_MS) / playbackSpeed);
      const crossfadeMs = Math.min(stepDuration * 0.4, Math.max(240, this.crossfadeSeconds * 1000));
      const holdMs = Math.max(200, stepDuration - crossfadeMs);
      const guidance = {
        title: step.display || step.token,
        subtitle: step.subtitle || DEFAULT_GUIDANCE.subtitle,
        badge: step.type === 'word' ? 'Word sign' : 'Letter sign',
        audience_hint: step.audience_hint || DEFAULT_GUIDANCE.audience_hint,
        left_hand_cue: step.left_hand_cue || DEFAULT_GUIDANCE.left_hand_cue,
        right_hand_cue: step.right_hand_cue || DEFAULT_GUIDANCE.right_hand_cue
      };

      renderAnimationQueue(this.queue, index);
      setCurrentAction(step.display || step.token);
      setAvatarStatus(`Playing "${step.display || step.token}" at ${playbackSpeed.toFixed(1)}x speed`);
      setHero(guidance.title, guidance.subtitle, guidance.badge);
      setCoach(guidance);
      setProgress(index + 1, this.queue.length);
      setAnimationLog([
        `Current token: ${step.token}`,
        `Readable cue: ${guidance.subtitle}`,
        `Audience hint: ${guidance.audience_hint}`,
        `Left hand: ${guidance.left_hand_cue}`,
        `Right hand: ${guidance.right_hand_cue}`,
        `Type: ${step.type}`,
        `Animation path: ${step.path}`,
        `Playback speed: ${playbackSpeed.toFixed(1)}x`,
        `Crossfade: ${this.crossfadeSeconds.toFixed(2)}s`,
        `Step ${index + 1} of ${this.queue.length}`
      ]);

      if (index === 0) {
        await this.rig.startStep(step, {
          playbackSpeed,
          crossfadeSeconds: this.crossfadeSeconds
        });
      }

      await new Promise((resolve) => {
        const holdTimeout = window.setTimeout(async () => {
          this.activeTimeouts.delete(holdTimeout);
          if (nextStep) {
            await this.rig.crossfadeToStep(nextStep, this.crossfadeSeconds, {
              playbackSpeed
            });
          }
          resolve();
        }, holdMs);
        this.activeTimeouts.add(holdTimeout);
      });

      if (nextStep) {
        await new Promise((resolve) => {
          const crossfadeTimeout = window.setTimeout(() => {
            this.activeTimeouts.delete(crossfadeTimeout);
            resolve();
          }, crossfadeMs);
          this.activeTimeouts.add(crossfadeTimeout);
        });
      }
    }

    this.isPlaying = false;
    this.queue = [];
    renderAnimationQueue([]);
    setCurrentAction('idle');
    setAvatarStatus('Animation queue completed.');
    setHero('Complete', 'Playback finished. The avatar signed the full queue.', 'Done');
    setCoach(DEFAULT_GUIDANCE);
    setProgress(0, 0);
    setAnimationLog('Playback finished. Three.js avatar queue is ready.');
    this.rig.stopSpeaking();
  }
}

async function requestAnimationSequence(text) {
  const response = await fetch('/api/animate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Animation API request failed.');
  }

  return Array.isArray(data.animations) ? data.animations : [];
}

const rig = new AvatarRig(avatarPreview);
rig.init();

const queuePlayer = new AnimationQueuePlayer(rig);
queuePlayer.reset();
window.avatarPlayback = {
  setPlaybackSpeed,
  reset: () => queuePlayer.reset()
};

playbackSpeedSelect?.addEventListener('change', (event) => {
  setPlaybackSpeed(event.target.value);
  setAvatarStatus(`Playback speed set to ${playbackSpeed.toFixed(2)}x`);
});

avatarForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (queuePlayer.isPlaying) {
    setAvatarStatus('Animation queue is already playing. Please wait.');
    return;
  }

  const text = avatarTextInput?.value.trim() || '';
  if (!text) {
    setAvatarStatus('Enter text before starting avatar playback.');
    setCurrentAction('idle');
    setHero('Waiting...', 'Enter text to start the avatar.', 'Idle');
    setCoach(DEFAULT_GUIDANCE);
    setProgress(0, 0);
    setAnimationLog('No input text provided.');
    renderAnimationQueue([]);
    return;
  }

  if (avatarSubmitBtn) {
    avatarSubmitBtn.disabled = true;
  }

  setAvatarStatus('Requesting animation queue from /api/animate...');
  setCurrentAction('building queue');
  setHero('Preparing', `Parsing "${text}" into visible sign steps.`, 'Loading');
  setCoach({
    title: 'Preparing sign plan',
    subtitle: 'The avatar is breaking text into visible, readable steps.',
    audience_hint: 'The system is building a clearer gesture sequence.',
    left_hand_cue: 'Waiting for the first cue.',
    right_hand_cue: 'Waiting for the first cue.'
  });
  setProgress(0, 0);
  setAnimationLog(`Input text: ${text}`);

  try {
    const animations = await requestAnimationSequence(text);

    if (!animations.length) {
      setAvatarStatus('No animations matched this text.');
      setCurrentAction('idle');
      setHero('No match', 'The API returned an empty queue for this text.', 'Empty');
      setCoach(DEFAULT_GUIDANCE);
      setProgress(0, 0);
      setAnimationLog('API returned an empty animation queue.');
      renderAnimationQueue([]);
      return;
    }

    queuePlayer.reset();
    queuePlayer.enqueue(animations);
    await queuePlayer.play();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown playback error.';
    queuePlayer.reset();
    setAvatarStatus('Failed to build avatar animation queue.');
    setCurrentAction('error');
    setHero('Error', message, 'Error');
    setCoach({
      title: 'Playback error',
      subtitle: 'The avatar could not complete the animation sequence.',
      audience_hint: message,
      left_hand_cue: 'Unavailable',
      right_hand_cue: 'Unavailable'
    });
    setAnimationLog(message);
  } finally {
    if (avatarSubmitBtn) {
      avatarSubmitBtn.disabled = false;
    }
  }
});

window.addEventListener('beforeunload', () => {
  queuePlayer.reset();
});
