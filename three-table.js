import * as THREE from "three";

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) =>
  t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

const lerp = (start, end, progress) =>
  start + (end - start) * progress;

export class HighStakesTable {
  constructor(canvas) {
    if (!canvas) {
      throw new Error("Game canvas unavailable");
    }

    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      43,
      1,
      0.1,
      100
    );
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance"
    });

    this.clock = new THREE.Clock();
    this.tweens = [];
    this.playerChips = [];
    this.potChips = [];
    this.currentPotCount = 0;

    this.fx = {
      win: 0,
      lose: 0,
      allIn: 0
    };

    this.cameraHome = new THREE.Vector3(
      0,
      7.2,
      10.4
    );
    this.cameraAnchor = this.cameraHome.clone();
    this.focusAnchor = new THREE.Vector3(
      0,
      0.38,
      0.15
    );

    this.dealerLook = 0;
    this.dealerLookTarget = 0;
    this.dealerHeadPitch = 0;
    this.dealerHeadPitchTarget = 0;

    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 1.7)
    );
    this.renderer.outputColorSpace =
      THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type =
      THREE.PCFSoftShadowMap;
    this.renderer.toneMapping =
      THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene.background = new THREE.Color(0x03100b);
    this.scene.fog = new THREE.FogExp2(
      0x03100b,
      0.038
    );
    this.camera.position.copy(this.cameraHome);

    this.build();
    this.resize();

    this.resizeObserver = new ResizeObserver(
      () => this.resize()
    );
    this.resizeObserver.observe(canvas);

    this.animate();
  }

  standardMaterial(
    color,
    roughness = 0.6,
    metalness = 0.05
  ) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness
    });
  }

  build() {
    this.ambient = new THREE.HemisphereLight(
      0xc8e4d7,
      0x140905,
      2.6
    );
    this.scene.add(this.ambient);

    this.keyLight = new THREE.SpotLight(
      0xffdc8a,
      74,
      40,
      Math.PI / 5.1,
      0.5,
      1.12
    );
    this.keyLight.position.set(0, 10, 4.4);
    this.keyLight.target.position.set(0, 0.1, -0.5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(
      this.keyLight,
      this.keyLight.target
    );

    this.fillLight = new THREE.PointLight(
      0x75d5a5,
      23,
      22
    );
    this.fillLight.position.set(-4.7, 3.1, 1.6);
    this.scene.add(this.fillLight);

    this.warmLight = new THREE.PointLight(
      0xd9783d,
      5,
      16
    );
    this.warmLight.position.set(4.2, 2.1, -1.8);
    this.scene.add(this.warmLight);

    this.selectionLight = new THREE.PointLight(
      0xf4d36d,
      0,
      8
    );
    this.selectionLight.position.set(0, 1.35, 0.9);
    this.scene.add(this.selectionLight);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.buildTable();
    this.buildAnswerZones();
    this.buildDealer();
    this.buildCard();
    this.buildChips();
    this.buildProps();
  }

  buildTable() {
    const wood = this.standardMaterial(
      0x321507,
      0.5,
      0.08
    );
    const felt = this.standardMaterial(
      0x087649,
      0.91,
      0.02
    );
    const brass = this.standardMaterial(
      0xd2a43e,
      0.25,
      0.8
    );

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(
        5.05,
        5.2,
        0.42,
        72
      ),
      wood
    );
    base.scale.z = 0.68;
    base.position.y = -0.42;
    base.castShadow = true;
    base.receiveShadow = true;
    this.root.add(base);

    const feltTop = new THREE.Mesh(
      new THREE.CylinderGeometry(
        4.62,
        4.62,
        0.16,
        72
      ),
      felt
    );
    feltTop.scale.z = 0.66;
    feltTop.position.y = -0.11;
    feltTop.receiveShadow = true;
    this.root.add(feltTop);

    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(
        3.83,
        0.24,
        18,
        100
      ),
      wood
    );
    rail.rotation.x = Math.PI / 2;
    rail.scale.y = 0.66;
    rail.position.y = 0.015;
    rail.castShadow = true;
    this.root.add(rail);

    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(
        3.57,
        0.05,
        12,
        100
      ),
      brass
    );
    trim.rotation.x = Math.PI / 2;
    trim.scale.y = 0.66;
    trim.position.y = 0.055;
    this.root.add(trim);

    const innerLine = new THREE.Mesh(
      new THREE.TorusGeometry(
        2.82,
        0.02,
        8,
        90
      ),
      new THREE.MeshBasicMaterial({
        color: 0x7bb394,
        transparent: true,
        opacity: 0.55
      })
    );
    innerLine.rotation.x = Math.PI / 2;
    innerLine.scale.y = 0.66;
    innerLine.position.y = 0.065;
    this.root.add(innerLine);
  }

  roundedRect(
    context,
    x,
    y,
    width,
    height,
    radius
  ) {
    const r = Math.min(
      radius,
      width / 2,
      height / 2
    );

    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(
      x + width,
      y,
      x + width,
      y + height,
      r
    );
    context.arcTo(
      x + width,
      y + height,
      x,
      y + height,
      r
    );
    context.arcTo(
      x,
      y + height,
      x,
      y,
      r
    );
    context.arcTo(
      x,
      y,
      x + width,
      y,
      r
    );
    context.closePath();
  }

  answerZoneTexture(
    label,
    subtitle,
    color
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 500;

    const context = canvas.getContext("2d");
    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    this.roundedRect(
      context,
      28,
      28,
      968,
      444,
      180
    );
    context.fillStyle = "rgba(3, 12, 8, .88)";
    context.fill();
    context.lineWidth = 15;
    context.strokeStyle = color;
    context.stroke();

    context.textAlign = "center";
    context.fillStyle = color;
    context.font = "400 154px Bebas Neue";
    context.fillText(label, 512, 250);

    context.fillStyle =
      "rgba(246, 240, 223, .75)";
    context.font = "800 34px Inter";
    context.fillText(subtitle, 512, 360);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(
      8,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    return texture;
  }

  buildAnswerZones() {
    this.zones = {};

    const makeZone = (
      key,
      label,
      subtitle,
      x,
      color
    ) => {
      const material = new THREE.MeshBasicMaterial({
        map: this.answerZoneTexture(
          label,
          subtitle,
          color
        ),
        transparent: true,
        opacity: 0.88,
        depthWrite: false
      });

      const zone = new THREE.Mesh(
        new THREE.PlaneGeometry(2.7, 1.32),
        material
      );
      zone.rotation.x = -Math.PI / 2;
      zone.position.set(x, 0.095, 0.92);
      this.root.add(zone);

      const frame = new THREE.Mesh(
        new THREE.TorusGeometry(
          0.9,
          0.032,
          10,
          72
        ),
        new THREE.MeshBasicMaterial({
          color: 0xf4d36d,
          transparent: true,
          opacity: 0
        })
      );
      frame.rotation.x = Math.PI / 2;
      frame.scale.y = 0.56;
      frame.position.set(x, 0.11, 0.92);
      this.root.add(frame);

      this.zones[key] = {
        zone,
        frame,
        material
      };
    };

    makeZone(
      "false",
      "FALSE",
      "CALL THE BLUFF",
      -1.95,
      "#df5555"
    );
    makeZone(
      "true",
      "TRUE",
      "BANK IT",
      1.95,
      "#62e592"
    );
  }

  buildDealer() {
    this.dealer = new THREE.Group();
    this.dealer.position.set(0, 0, -3.4);
    this.root.add(this.dealer);

    const suitMaterial = this.standardMaterial(
      0x171b19,
      0.84,
      0.02
    );
    const vestMaterial = this.standardMaterial(
      0x4a1717,
      0.76,
      0.03
    );
    const shirtMaterial = this.standardMaterial(
      0xe8e1d1,
      0.76,
      0.01
    );
    const maskMaterial = this.standardMaterial(
      0xd8c29c,
      0.7,
      0.04
    );
    const goldMaterial = this.standardMaterial(
      0xd4a642,
      0.26,
      0.74
    );
    const gloveMaterial = this.standardMaterial(
      0x191b1a,
      0.78,
      0.02
    );

    this.dealerTorso = new THREE.Group();
    this.dealer.add(this.dealerTorso);

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(
        1.62,
        1.5,
        0.58
      ),
      suitMaterial
    );
    torso.position.set(0, 1.18, 0);
    torso.castShadow = true;
    this.dealerTorso.add(torso);

    const shirt = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.58,
        1.02,
        0.075
      ),
      shirtMaterial
    );
    shirt.position.set(0, 1.28, 0.33);
    shirt.castShadow = true;
    this.dealerTorso.add(shirt);

    const leftVest = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.43,
        1.02,
        0.085
      ),
      vestMaterial
    );
    leftVest.position.set(-0.4, 1.25, 0.37);
    leftVest.rotation.z = -0.06;
    leftVest.castShadow = true;

    const rightVest = leftVest.clone();
    rightVest.position.x = 0.4;
    rightVest.rotation.z = 0.06;

    this.dealerTorso.add(
      leftVest,
      rightVest
    );

    const leftBow = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.28,
        0.13,
        0.09
      ),
      goldMaterial
    );
    leftBow.position.set(-0.14, 1.77, 0.42);
    leftBow.rotation.z = -0.42;

    const rightBow = leftBow.clone();
    rightBow.position.x = 0.14;
    rightBow.rotation.z = 0.42;

    this.dealerTorso.add(
      leftBow,
      rightBow
    );

    const leftShoulder = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.37,
        20,
        14
      ),
      suitMaterial
    );
    leftShoulder.position.set(-0.83, 1.55, 0);
    leftShoulder.scale.set(1, 0.78, 1);
    leftShoulder.castShadow = true;

    const rightShoulder = leftShoulder.clone();
    rightShoulder.position.x = 0.83;

    this.dealerTorso.add(
      leftShoulder,
      rightShoulder
    );

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.16,
        0.18,
        0.24,
        20
      ),
      maskMaterial
    );
    neck.position.set(0, 2.02, 0);
    neck.castShadow = true;
    this.dealer.add(neck);

    this.dealerHead = new THREE.Group();
    this.dealerHead.position.set(0, 2.42, 0.02);
    this.dealer.add(this.dealerHead);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.44,
        28,
        20
      ),
      suitMaterial
    );
    head.scale.set(0.94, 1.1, 0.9);
    head.castShadow = true;
    this.dealerHead.add(head);

    const mask = new THREE.Mesh(
      new THREE.CircleGeometry(0.31, 32),
      maskMaterial
    );
    mask.position.set(0, -0.01, 0.4);
    this.dealerHead.add(mask);

    const eyeMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x17140b
      });

    const leftEye = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.045,
        12,
        8
      ),
      eyeMaterial
    );
    leftEye.position.set(-0.12, 0.055, 0.43);

    const rightEye = leftEye.clone();
    rightEye.position.x = 0.12;

    this.dealerHead.add(
      leftEye,
      rightEye
    );

    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.4,
        0.035,
        0.035
      ),
      goldMaterial
    );
    brow.position.set(0, 0.18, 0.43);
    this.dealerHead.add(brow);

    const buildArm = (side) => {
      const arm = new THREE.Group();
      arm.position.set(
        side * 0.82,
        1.54,
        0.02
      );
      arm.rotation.z = side * -0.14;
      this.dealer.add(arm);

      const upper = new THREE.Mesh(
        new THREE.CapsuleGeometry(
          0.155,
          0.5,
          6,
          12
        ),
        suitMaterial
      );
      upper.position.y = -0.34;
      upper.castShadow = true;
      arm.add(upper);

      const forearm = new THREE.Group();
      forearm.position.set(0, -0.69, 0.04);
      forearm.rotation.x = 1.08;
      arm.add(forearm);

      const sleeve = new THREE.Mesh(
        new THREE.CapsuleGeometry(
          0.14,
          0.55,
          6,
          12
        ),
        suitMaterial
      );
      sleeve.position.y = -0.31;
      sleeve.castShadow = true;
      forearm.add(sleeve);

      const cuff = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.15,
          0.15,
          0.13,
          18
        ),
        shirtMaterial
      );
      cuff.position.y = -0.64;
      cuff.castShadow = true;
      forearm.add(cuff);

      const hand = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.18,
          18,
          12
        ),
        gloveMaterial
      );
      hand.position.y = -0.78;
      hand.scale.set(1.05, 0.72, 1.2);
      hand.castShadow = true;
      forearm.add(hand);

      return {
        group: arm,
        forearm,
        hand,
        baseRotationZ: arm.rotation.z,
        baseForearmX: forearm.rotation.x
      };
    };

    this.dealerLeftArm = buildArm(-1);
    this.dealerRightArm = buildArm(1);

    const chair = new THREE.Mesh(
      new THREE.BoxGeometry(
        2.2,
        1.75,
        0.25
      ),
      this.standardMaterial(
        0x0e1713,
        0.9,
        0.01
      )
    );
    chair.position.set(0, 1.36, -0.38);
    chair.castShadow = true;
    this.dealer.add(chair);
    chair.renderOrder = -1;
  }

  buildCard() {
    this.cardOuter = new THREE.Group();
    this.cardOuter.position.set(0, 0.2, -0.48);
    this.cardOuter.rotation.x = 0.11;
    this.root.add(this.cardOuter);

    this.cardFlip = new THREE.Group();
    this.cardOuter.add(this.cardFlip);

    this.cardBaseMaterial = this.standardMaterial(
      0xbba982,
      0.68,
      0.02
    );

    this.cardBase = new THREE.Mesh(
      new THREE.BoxGeometry(
        3.2,
        0.09,
        1.92
      ),
      this.cardBaseMaterial
    );
    this.cardBase.castShadow = true;
    this.cardBase.receiveShadow = true;
    this.cardFlip.add(this.cardBase);

    this.cardBackMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.68,
        metalness: 0.01
      });

    this.verdictMaterial =
      this.cardBackMaterial.clone();

    this.cardTop = new THREE.Mesh(
      new THREE.PlaneGeometry(
        3.1,
        1.82
      ),
      this.cardBackMaterial
    );
    this.cardTop.rotation.x = -Math.PI / 2;
    this.cardTop.position.y = 0.051;
    this.cardFlip.add(this.cardTop);

    this.cardBottom = new THREE.Mesh(
      new THREE.PlaneGeometry(
        3.1,
        1.82
      ),
      this.verdictMaterial
    );
    this.cardBottom.rotation.x = Math.PI / 2;
    this.cardBottom.rotation.z = Math.PI;
    this.cardBottom.position.y = -0.051;
    this.cardFlip.add(this.cardBottom);

    this.cardBackMaterial.map =
      this.makeCardBackTexture();
    this.cardBackMaterial.needsUpdate = true;
  }

  makeCardBackTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 720;
    const context = canvas.getContext("2d");

    const gradient = context.createLinearGradient(
      0,
      0,
      canvas.width,
      canvas.height
    );
    gradient.addColorStop(0, "#102e25");
    gradient.addColorStop(1, "#06140f");

    context.fillStyle = gradient;
    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    context.strokeStyle = "#d5aa48";
    context.lineWidth = 18;
    context.strokeRect(
      28,
      28,
      canvas.width - 56,
      canvas.height - 56
    );

    context.strokeStyle =
      "rgba(213, 170, 72, .34)";
    context.lineWidth = 4;
    context.strokeRect(
      56,
      56,
      canvas.width - 112,
      canvas.height - 112
    );

    context.textAlign = "center";
    context.fillStyle = "#d9b75d";
    context.font = "400 122px Bebas Neue";
    context.fillText(
      "HIGH STAKES",
      600,
      295
    );
    context.fillText(
      "TRUTH",
      600,
      420
    );

    context.font = "400 76px Georgia";
    context.fillText(
      "♠   ♦   ♣   ♥",
      600,
      545
    );

    context.fillStyle =
      "rgba(246, 240, 223, .62)";
    context.font = "800 28px Inter";
    context.fillText(
      "THE HOUSE HAS ONE ANSWER",
      600,
      625
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(
      8,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    return texture;
  }

  makeVerdictTexture(answer) {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 720;
    const context = canvas.getContext("2d");

    const gradient = context.createLinearGradient(
      0,
      0,
      canvas.width,
      canvas.height
    );
    gradient.addColorStop(0, "#fffdf6");
    gradient.addColorStop(1, "#e8ddc3");

    context.fillStyle = gradient;
    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    const color = answer
      ? "#137344"
      : "#b12d34";

    context.strokeStyle = "#b49348";
    context.lineWidth = 18;
    context.strokeRect(
      28,
      28,
      canvas.width - 56,
      canvas.height - 56
    );

    context.textAlign = "center";
    context.fillStyle = "#73796e";
    context.font = "900 31px Inter";
    context.fillText(
      "HOUSE VERDICT",
      600,
      118
    );

    context.fillStyle = color;
    context.font = "400 270px Bebas Neue";
    context.fillText(
      answer ? "TRUE" : "FALSE",
      600,
      405
    );

    context.strokeStyle = color;
    context.lineWidth = 12;
    context.strokeRect(
      280,
      175,
      640,
      285
    );

    context.fillStyle = "#6f756a";
    context.font = "900 30px Inter";
    context.fillText(
      "THE CARD DOES NOT LIE",
      600,
      585
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(
      8,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    return texture;
  }

  createChip(color) {
    const chip = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.235,
        0.235,
        0.076,
        32
      ),
      this.standardMaterial(
        color,
        0.34,
        0.2
      )
    );
    body.castShadow = true;
    chip.add(body);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        0.177,
        0.021,
        8,
        28
      ),
      this.standardMaterial(
        0xf7df92,
        0.26,
        0.65
      )
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.041;
    chip.add(ring);

    return chip;
  }

  buildChips() {
    const colors = [
      0xf0c75a,
      0xe8e2cf,
      0xc43b3b,
      0x202120
    ];

    this.playerChipGroup = new THREE.Group();
    this.playerChipGroup.position.set(
      0,
      0.07,
      2.38
    );
    this.root.add(this.playerChipGroup);

    for (let stack = 0; stack < 4; stack += 1) {
      for (let level = 0; level < 4; level += 1) {
        const chip = this.createChip(
          colors[stack]
        );
        chip.position.set(
          (stack - 1.5) * 0.53,
          level * 0.082,
          0
        );
        chip.rotation.y =
          (stack + level) * 0.23;
        this.playerChipGroup.add(chip);
        this.playerChips.push(chip);
      }
    }

    this.potGroup = new THREE.Group();
    this.potGroup.position.set(
      0,
      0.09,
      1.42
    );
    this.root.add(this.potGroup);

    for (let index = 0; index < 16; index += 1) {
      const chip = this.createChip(
        colors[index % colors.length]
      );
      chip.visible = false;
      this.potGroup.add(chip);
      this.potChips.push(chip);
    }
  }

  buildProps() {
    const dealerButton = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.28,
        0.28,
        0.075,
        32
      ),
      this.standardMaterial(
        0xd0a33d,
        0.24,
        0.82
      )
    );
    dealerButton.position.set(
      -3.0,
      0.1,
      -1.62
    );
    dealerButton.castShadow = true;
    this.root.add(dealerButton);

    const discardTray = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.85,
        0.12,
        1.18
      ),
      this.standardMaterial(
        0x171d19,
        0.84,
        0.04
      )
    );
    discardTray.position.set(
      2.95,
      0.1,
      -1.58
    );
    discardTray.rotation.y = -0.08;
    discardTray.castShadow = true;
    this.root.add(discardTray);
  }

  potTarget(index, count) {
    const stacks = Math.ceil(count / 4);
    const stack = Math.floor(index / 4);
    const level = index % 4;

    return new THREE.Vector3(
      (stack - (stacks - 1) / 2) * 0.46,
      level * 0.082,
      stack % 2 === 0 ? 0 : 0.045
    );
  }

  playerSourceInPot(index) {
    const sourceChip = this.playerChips[index];
    return this.playerChipGroup.position
      .clone()
      .add(sourceChip.position)
      .sub(this.potGroup.position);
  }

  async setWager(percent) {
    const nextCount = Math.max(
      1,
      Math.round(this.potChips.length * percent)
    );
    const previousCount = this.currentPotCount;

    this.potGroup.position.set(
      0,
      0.09,
      1.42
    );
    this.potGroup.rotation.set(0, 0, 0);

    const motions = [];

    for (
      let index = 0;
      index < this.potChips.length;
      index += 1
    ) {
      const potChip = this.potChips[index];
      const playerChip = this.playerChips[index];

      if (index < nextCount) {
        const start =
          index < previousCount
            ? potChip.position.clone()
            : this.playerSourceInPot(index);
        const end = this.potTarget(
          index,
          nextCount
        );

        potChip.visible = true;
        potChip.position.copy(start);
        playerChip.visible = false;

        motions.push({
          chip: potChip,
          start,
          end,
          returning: false
        });
      } else if (index < previousCount) {
        const start = potChip.position.clone();
        const end = this.playerSourceInPot(index);

        potChip.visible = true;
        playerChip.visible = false;

        motions.push({
          chip: potChip,
          start,
          end,
          returning: true,
          playerChip
        });
      } else {
        potChip.visible = false;
        playerChip.visible = true;
      }
    }

    await this.tween(460, (progress) => {
      const eased = easeInOut(progress);
      const arc = Math.sin(progress * Math.PI) * 0.42;

      motions.forEach((motion) => {
        motion.chip.position.lerpVectors(
          motion.start,
          motion.end,
          eased
        );
        motion.chip.position.y += arc;
        motion.chip.rotation.y += 0.045;
      });
    });

    motions.forEach((motion) => {
      motion.chip.position.copy(motion.end);

      if (motion.returning) {
        motion.chip.visible = false;
        motion.playerChip.visible = true;
      }
    });

    for (
      let index = 0;
      index < this.playerChips.length;
      index += 1
    ) {
      this.playerChips[index].visible =
        index >= nextCount;
    }

    this.currentPotCount = nextCount;

    if (percent === 1) {
      this.fx.allIn = 1;

      await this.tween(260, (progress) => {
        this.potGroup.rotation.y =
          Math.sin(progress * Math.PI) * 0.08;
      });

      this.potGroup.rotation.y = 0;
    }
  }

  resetZones() {
    Object.values(this.zones).forEach((zone) => {
      zone.frame.material.opacity = 0;
      zone.zone.scale.setScalar(1);
    });

    this.selectionLight.intensity = 0;
  }

  async chooseAnswer(choice) {
    this.resetZones();

    const selected =
      this.zones[choice ? "true" : "false"];

    selected.frame.material.opacity = 0.95;
    selected.zone.scale.setScalar(1.045);

    this.selectionLight.intensity = 13;
    this.selectionLight.position.x =
      choice ? 1.95 : -1.95;

    this.dealerLookTarget =
      choice ? -0.12 : 0.12;

    const start = this.potGroup.position.clone();
    const target = new THREE.Vector3(
      choice ? 1.9 : -1.9,
      0.09,
      0.8
    );

    await this.tween(530, (progress) => {
      const eased = easeInOut(progress);

      this.potGroup.position.lerpVectors(
        start,
        target,
        eased
      );
      this.potGroup.position.y +=
        Math.sin(progress * Math.PI) * 0.38;
      this.potGroup.rotation.z =
        Math.sin(progress * Math.PI) *
        (choice ? -0.09 : 0.09);
    });

    this.potGroup.position.copy(target);
    this.potGroup.rotation.z = 0;
  }

  async dealFact(fact) {
    this.currentFact = fact;
    this.resetZones();

    this.cardFlip.rotation.x = 0;
    this.cardOuter.position.set(
      0,
      1.05,
      -2.75
    );
    this.cardOuter.rotation.set(
      0.2,
      -0.02,
      -0.045
    );
    this.cardOuter.scale.setScalar(0.72);

    if (this.verdictMaterial.map) {
      this.verdictMaterial.map.dispose();
    }

    this.verdictMaterial.map =
      this.makeVerdictTexture(fact.answer);
    this.verdictMaterial.needsUpdate = true;

    const armStart =
      this.dealerRightArm.group.rotation.z;
    const forearmStart =
      this.dealerRightArm.forearm.rotation.x;

    await Promise.all([
      this.tween(720, (progress) => {
        const eased = easeOut(progress);

        this.cardOuter.position.set(
          0,
          lerp(1.05, 0.2, eased),
          lerp(-2.75, -0.48, eased)
        );
        this.cardOuter.rotation.x =
          lerp(0.2, 0.11, eased);
        this.cardOuter.rotation.z =
          lerp(-0.045, 0, eased);
        this.cardOuter.scale.setScalar(
          lerp(0.72, 1, eased)
        );
      }),
      this.tween(560, (progress) => {
        const pulse =
          Math.sin(progress * Math.PI);

        this.dealerRightArm.group.rotation.z =
          armStart - pulse * 0.2;
        this.dealerRightArm.forearm.rotation.x =
          forearmStart + pulse * 0.24;
      })
    ]);

    this.cardOuter.position.set(
      0,
      0.2,
      -0.48
    );
    this.cardOuter.rotation.set(
      0.11,
      0,
      0
    );
    this.cardOuter.scale.setScalar(1);

    this.dealerRightArm.group.rotation.z =
      this.dealerRightArm.baseRotationZ;
    this.dealerRightArm.forearm.rotation.x =
      this.dealerRightArm.baseForearmX;
  }

  async dramaticCountdown(onBeat) {
    const values = ["3", "2", "1", "REVEAL"];
    const cameraStart = this.cameraAnchor.clone();
    const cameraEnd = this.cameraHome
      .clone()
      .add(new THREE.Vector3(0, -0.12, -0.42));

    const torsoStart =
      this.dealerTorso.position.z;
    const armBase =
      this.dealerRightArm.forearm.rotation.x;

    this.keyLight.intensity = 64;
    this.fillLight.intensity = 16;

    for (
      let index = 0;
      index < values.length;
      index += 1
    ) {
      const value = values[index];
      onBeat?.(value);

      const duration =
        value === "REVEAL" ? 720 : 650;

      await this.tween(duration, (progress) => {
        const globalProgress =
          (index + progress) / values.length;
        const cameraProgress =
          easeInOut(globalProgress);
        const beat =
          Math.sin(progress * Math.PI);

        this.cameraAnchor.lerpVectors(
          cameraStart,
          cameraEnd,
          cameraProgress
        );

        this.dealerTorso.position.z =
          torsoStart + globalProgress * 0.08;

        this.dealerHeadPitchTarget =
          beat * 0.055;

        this.dealerRightArm.forearm.rotation.x =
          armBase + beat * 0.08;

        this.cardOuter.position.y =
          0.2 + beat * 0.018;
      });
    }

    this.cameraAnchor.copy(cameraEnd);
    this.dealerHeadPitchTarget = 0;
    this.dealerTorso.position.z =
      torsoStart + 0.08;
    this.dealerRightArm.forearm.rotation.x =
      armBase;
    this.cardOuter.position.y = 0.2;
  }

  async revealCard(correct) {
    const positionStart =
      this.cardOuter.position.clone();
    const rotationStart =
      this.cardOuter.rotation.clone();
    const scaleStart =
      this.cardOuter.scale.x;

    const cameraStart =
      this.cameraAnchor.clone();
    const focusStart =
      this.focusAnchor.clone();

    const cardTarget = new THREE.Vector3(
      0,
      1.43,
      -1.88
    );
    const cameraTarget =
      this.cameraHome
        .clone()
        .add(new THREE.Vector3(0, -0.2, -0.48));
    const focusTarget =
      new THREE.Vector3(0, 1.0, -0.85);

    const armStart =
      this.dealerRightArm.group.rotation.z;
    const forearmStart =
      this.dealerRightArm.forearm.rotation.x;

    await Promise.all([
      this.tween(980, (progress) => {
        const eased = easeInOut(progress);

        this.cardFlip.rotation.x =
          Math.PI * eased;

        this.cardOuter.position.lerpVectors(
          positionStart,
          cardTarget,
          eased
        );
        this.cardOuter.position.y +=
          Math.sin(progress * Math.PI) * 0.28;

        this.cardOuter.rotation.x =
          lerp(rotationStart.x, 0.72, eased);
        this.cardOuter.rotation.z =
          Math.sin(progress * Math.PI) * -0.025;

        const scale =
          lerp(scaleStart, 0.98, eased);
        this.cardOuter.scale.setScalar(scale);
      }),
      this.tween(980, (progress) => {
        const eased = easeInOut(progress);
        const reach =
          Math.sin(progress * Math.PI);

        this.dealerRightArm.group.rotation.z =
          armStart - reach * 0.36;
        this.dealerRightArm.forearm.rotation.x =
          forearmStart + reach * 0.46;

        this.dealerHeadPitchTarget =
          lerp(0, -0.055, eased);

        this.cameraAnchor.lerpVectors(
          cameraStart,
          cameraTarget,
          eased
        );
        this.focusAnchor.lerpVectors(
          focusStart,
          focusTarget,
          eased
        );
      })
    ]);

    this.cardOuter.position.copy(cardTarget);
    this.cardOuter.rotation.set(0.72, 0, 0);
    this.cardOuter.scale.setScalar(0.98);

    this.cameraAnchor.copy(cameraTarget);
    this.focusAnchor.copy(focusTarget);

    this.dealerRightArm.group.rotation.z =
      armStart - 0.18;
    this.dealerRightArm.forearm.rotation.x =
      forearmStart + 0.24;

    this.dealerHeadPitchTarget =
      correct ? -0.025 : 0.02;

    this.fx[correct ? "win" : "lose"] = 1;

    this.keyLight.color.setHex(
      correct ? 0xffd66e : 0xff5b5b
    );
    this.fillLight.color.setHex(
      correct ? 0x65d995 : 0x742323
    );
  }

  async resolveChips(correct) {
    const start =
      this.potGroup.position.clone();

    if (correct) {
      await this.tween(720, (progress) => {
        const eased = easeOut(progress);

        this.potGroup.position.lerpVectors(
          start,
          new THREE.Vector3(0, 0.09, 2.38),
          eased
        );
        this.potGroup.position.y +=
          Math.sin(progress * Math.PI) * 0.48;
        this.potGroup.rotation.y =
          Math.sin(progress * Math.PI) * 0.38;
      });
    } else {
      const armStart =
        this.dealerLeftArm.group.rotation.z;
      const forearmStart =
        this.dealerLeftArm.forearm.rotation.x;

      await Promise.all([
        this.tween(700, (progress) => {
          const eased = easeInOut(progress);

          this.potGroup.position.lerpVectors(
            start,
            new THREE.Vector3(0, 0.16, -2.85),
            eased
          );
          this.potGroup.position.y +=
            Math.sin(progress * Math.PI) * 0.24;
        }),
        this.tween(700, (progress) => {
          const sweep =
            Math.sin(progress * Math.PI);

          this.dealerLeftArm.group.rotation.z =
            armStart + sweep * 0.35;
          this.dealerLeftArm.forearm.rotation.x =
            forearmStart + sweep * 0.42;
        })
      ]);

      this.dealerLeftArm.group.rotation.z =
        armStart;
      this.dealerLeftArm.forearm.rotation.x =
        forearmStart;
    }

    this.potChips.forEach((chip) => {
      chip.visible = false;
    });

    this.playerChips.forEach((chip) => {
      chip.visible = true;
    });

    this.currentPotCount = 0;
    this.potGroup.position.set(
      0,
      0.09,
      1.42
    );
    this.potGroup.rotation.set(0, 0, 0);
  }

  async resetRound() {
    this.resetZones();

    this.keyLight.color.setHex(0xffdc8a);
    this.fillLight.color.setHex(0x75d5a5);
    this.keyLight.intensity = 74;
    this.fillLight.intensity = 23;

    this.cameraAnchor.copy(this.cameraHome);
    this.focusAnchor.set(0, 0.38, 0.15);

    this.dealerLookTarget = 0;
    this.dealerHeadPitchTarget = 0;
    this.dealerTorso.position.z = 0;

    this.dealerLeftArm.group.rotation.z =
      this.dealerLeftArm.baseRotationZ;
    this.dealerLeftArm.forearm.rotation.x =
      this.dealerLeftArm.baseForearmX;

    this.dealerRightArm.group.rotation.z =
      this.dealerRightArm.baseRotationZ;
    this.dealerRightArm.forearm.rotation.x =
      this.dealerRightArm.baseForearmX;

    this.cardFlip.rotation.x = 0;
    this.cardOuter.position.set(
      0,
      0.2,
      -0.48
    );
    this.cardOuter.rotation.set(
      0.11,
      0,
      0
    );
    this.cardOuter.scale.setScalar(1);

    this.potGroup.position.set(
      0,
      0.09,
      1.42
    );
    this.potGroup.rotation.set(0, 0, 0);

    this.currentPotCount = 0;

    this.potChips.forEach((chip) => {
      chip.visible = false;
    });

    this.playerChips.forEach((chip) => {
      chip.visible = true;
    });

    await this.tween(220, () => {});
  }

  setSkin(skin) {
    const skins = {
      "": {
        face: 0xffffff,
        side: 0xbba982
      },
      blueprint: {
        face: 0x7199cc,
        side: 0x173d6b
      },
      gold: {
        face: 0xc8a04b,
        side: 0x4b300a
      },
      cyber: {
        face: 0x31536f,
        side: 0x08151f
      }
    };

    const selected =
      skins[skin] || skins[""];

    this.cardBackMaterial.color.setHex(
      selected.face
    );
    this.verdictMaterial.color.setHex(
      selected.face
    );
    this.cardBaseMaterial.color.setHex(
      selected.side
    );
  }

  tween(duration, update) {
    return new Promise((resolve) => {
      this.tweens.push({
        start: performance.now(),
        duration,
        update,
        resolve
      });
    });
  }

  updateTweens(now) {
    this.tweens = this.tweens.filter((tween) => {
      const progress = Math.min(
        1,
        (now - tween.start) / tween.duration
      );

      tween.update(progress);

      if (progress >= 1) {
        tween.resolve();
        return false;
      }

      return true;
    });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();

    if (rect.width < 2 || rect.height < 2) {
      return;
    }

    this.renderer.setSize(
      rect.width,
      rect.height,
      false
    );

    this.camera.aspect =
      rect.width / rect.height;
    this.camera.fov =
      this.camera.aspect < 0.72 ? 47 : 43;
    this.camera.updateProjectionMatrix();

    const scale =
      this.camera.aspect < 0.62
        ? 0.84
        : this.camera.aspect < 0.78
          ? 0.92
          : 1;

    this.root.scale.setScalar(scale);
  }

  animate = () => {
    requestAnimationFrame(this.animate);

    const now = performance.now();
    const elapsed = this.clock.getElapsedTime();

    this.updateTweens(now);

    this.fx.win *= 0.95;
    this.fx.lose *= 0.92;
    this.fx.allIn *= 0.96;

    this.dealerLook = THREE.MathUtils.lerp(
      this.dealerLook,
      this.dealerLookTarget,
      0.08
    );
    this.dealerHeadPitch =
      THREE.MathUtils.lerp(
        this.dealerHeadPitch,
        this.dealerHeadPitchTarget,
        0.1
      );

    this.dealer.position.y =
      Math.sin(elapsed * 1.2) * 0.012;

    this.dealerTorso.scale.y =
      1 + Math.sin(elapsed * 1.2) * 0.006;

    this.dealerHead.rotation.y =
      this.dealerLook +
      Math.sin(elapsed * 0.38) * 0.012;

    this.dealerHead.rotation.x =
      this.dealerHeadPitch +
      Math.sin(elapsed * 0.65) * 0.006;

    const desiredCamera =
      this.cameraAnchor.clone();

    if (!this.tweens.length) {
      desiredCamera.x +=
        Math.sin(elapsed * 0.27) * 0.022;
      desiredCamera.y +=
        Math.sin(elapsed * 0.38) * 0.013;
    }

    if (this.fx.lose > 0.02) {
      desiredCamera.x +=
        Math.sin(elapsed * 62) *
        this.fx.lose *
        0.04;
      desiredCamera.y +=
        Math.cos(elapsed * 58) *
        this.fx.lose *
        0.02;
    }

    this.camera.position.lerp(
      desiredCamera,
      0.13
    );
    this.camera.lookAt(this.focusAnchor);

    this.keyLight.intensity =
      74 +
      this.fx.win * 28 -
      this.fx.lose * 8;

    this.renderer.render(
      this.scene,
      this.camera
    );
  };
}
