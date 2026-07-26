
import * as THREE from "three";

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export class HighStakesTable {
  constructor(canvas) {
    if (!canvas) throw new Error("Game canvas unavailable");

    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance"
    });

    this.clock = new THREE.Clock();
    this.tweens = [];
    this.fx = { win: 0, lose: 0, allIn: 0 };
    this.potChips = [];
    this.playerChips = [];
    this.counter = null;

    this.cameraHome = new THREE.Vector3(0, 7.35, 10.65);
    this.cameraAnchor = this.cameraHome.clone();
    this.focusAnchor = new THREE.Vector3(0, 0.08, 0.45);

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;

    this.scene.background = new THREE.Color(0x03100b);
    this.scene.fog = new THREE.FogExp2(0x03100b, 0.042);
    this.camera.position.copy(this.cameraHome);

    this.build();
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.animate();
  }

  material(color, roughness = 0.6, metalness = 0.05) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  build() {
    this.ambient = new THREE.HemisphereLight(0xc6e4d5, 0x160a05, 2.65);
    this.scene.add(this.ambient);

    this.key = new THREE.SpotLight(0xffdc8a, 76, 40, Math.PI / 5.1, 0.5, 1.12);
    this.key.position.set(0, 10, 4.5);
    this.key.target.position.set(0, 0, -0.4);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.key, this.key.target);

    this.fill = new THREE.PointLight(0x76d6a5, 24, 22);
    this.fill.position.set(-4.8, 3.2, 1.8);
    this.scene.add(this.fill);

    this.red = new THREE.PointLight(0x8f2020, 4, 16);
    this.red.position.set(4.8, 2.2, 0.4);
    this.scene.add(this.red);

    this.selectionLight = new THREE.PointLight(0xf4d36d, 0, 8);
    this.selectionLight.position.set(0, 1.5, 1.1);
    this.scene.add(this.selectionLight);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.buildTable();
    this.buildZones();
    this.buildCard();
    this.buildChips();
    this.buildHands();
    this.buildProps();
  }

  buildTable() {
    const wood = this.material(0x321507, 0.5, 0.08);
    const felt = this.material(0x087a49, 0.91, 0.02);
    const brass = this.material(0xd2a43e, 0.25, 0.8);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(5.05, 5.2, 0.42, 72),
      wood
    );
    base.scale.z = 0.68;
    base.position.y = -0.42;
    base.castShadow = true;
    base.receiveShadow = true;
    this.root.add(base);

    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(4.62, 4.62, 0.16, 72),
      felt
    );
    top.scale.z = 0.66;
    top.position.y = -0.11;
    top.receiveShadow = true;
    this.root.add(top);

    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(3.83, 0.24, 18, 100),
      wood
    );
    rail.rotation.x = Math.PI / 2;
    rail.scale.y = 0.66;
    rail.position.y = 0.015;
    rail.castShadow = true;
    this.root.add(rail);

    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(3.57, 0.05, 12, 100),
      brass
    );
    trim.rotation.x = Math.PI / 2;
    trim.scale.y = 0.66;
    trim.position.y = 0.055;
    this.root.add(trim);

    const innerLine = new THREE.Mesh(
      new THREE.TorusGeometry(2.82, 0.02, 8, 90),
      new THREE.MeshBasicMaterial({
        color: 0x7bb394,
        transparent: true,
        opacity: 0.58
      })
    );
    innerLine.rotation.x = Math.PI / 2;
    innerLine.scale.y = 0.66;
    innerLine.position.y = 0.065;
    this.root.add(innerLine);
  }

  roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  zoneTexture(label, subtitle, color) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 500;
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);
    this.roundedRect(context, 28, 28, 968, 444, 180);
    context.fillStyle = "rgba(3, 12, 8, .84)";
    context.fill();
    context.lineWidth = 16;
    context.strokeStyle = color;
    context.stroke();

    context.textAlign = "center";
    context.fillStyle = color;
    context.font = "400 154px Bebas Neue";
    context.fillText(label, 512, 250);

    context.fillStyle = "rgba(246, 240, 223, .72)";
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

  buildZones() {
    this.zones = {};

    const make = (key, label, subtitle, x, color) => {
      const material = new THREE.MeshBasicMaterial({
        map: this.zoneTexture(label, subtitle, color),
        transparent: true,
        opacity: 0.9,
        depthWrite: false
      });

      const zone = new THREE.Mesh(
        new THREE.PlaneGeometry(2.85, 1.42),
        material
      );
      zone.rotation.x = -Math.PI / 2;
      zone.position.set(x, 0.095, 0.92);
      this.root.add(zone);

      const frame = new THREE.Mesh(
        new THREE.TorusGeometry(0.94, 0.032, 10, 72),
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

      this.zones[key] = { zone, frame, material };
    };

    make("false", "FALSE", "CALL THE BLUFF", -2.0, "#df4f4f");
    make("true", "TRUE", "BANK IT", 2.0, "#5ae68b");
  }

  buildCard() {
    this.cardOuter = new THREE.Group();
    this.cardOuter.position.set(0, 0.22, -0.48);
    this.cardOuter.rotation.x = 0.12;
    this.root.add(this.cardOuter);

    this.cardFlip = new THREE.Group();
    this.cardOuter.add(this.cardFlip);

    this.cardBaseMaterial = this.material(0xc2b495, 0.7, 0.01);
    this.cardBase = new THREE.Mesh(
      new THREE.BoxGeometry(4.22, 0.1, 2.66),
      this.cardBaseMaterial
    );
    this.cardBase.castShadow = true;
    this.cardBase.receiveShadow = true;
    this.cardFlip.add(this.cardBase);

    this.frontMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.01
    });
    this.backMaterial = this.frontMaterial.clone();

    this.frontPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(4.12, 2.56),
      this.frontMaterial
    );
    this.frontPlane.rotation.x = -Math.PI / 2;
    this.frontPlane.position.y = 0.056;
    this.frontPlane.receiveShadow = true;
    this.cardFlip.add(this.frontPlane);

    this.backPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(4.12, 2.56),
      this.backMaterial
    );
    this.backPlane.rotation.x = Math.PI / 2;
    this.backPlane.rotation.z = Math.PI;
    this.backPlane.position.y = -0.056;
    this.backPlane.receiveShadow = true;
    this.cardFlip.add(this.backPlane);
  }

  createChip(color) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.076, 32),
      this.material(color, 0.34, 0.2)
    );
    body.castShadow = true;
    group.add(body);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.021, 8, 28),
      this.material(0xf7df92, 0.26, 0.65)
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.041;
    group.add(ring);

    return group;
  }

  buildChips() {
    const colors = [0xf0c75a, 0xe8e2cf, 0xc43b3b, 0x202120];

    this.playerGroup = new THREE.Group();
    this.playerGroup.position.set(0, 0.07, 2.45);
    this.root.add(this.playerGroup);

    for (let stack = 0; stack < 4; stack += 1) {
      for (let level = 0; level < 4; level += 1) {
        const chip = this.createChip(colors[stack]);
        chip.position.set(
          (stack - 1.5) * 0.55,
          level * 0.082,
          0
        );
        chip.rotation.y = (stack + level) * 0.25;
        this.playerGroup.add(chip);
        this.playerChips.push(chip);
      }
    }

    this.potGroup = new THREE.Group();
    this.potGroup.position.set(0, 0.09, 1.52);
    this.root.add(this.potGroup);

    for (let index = 0; index < 12; index += 1) {
      const chip = this.createChip(colors[index % colors.length]);
      chip.visible = false;
      this.potGroup.add(chip);
      this.potChips.push(chip);
    }
  }

  buildHands() {
    const glove = this.material(0x171918, 0.82);
    const cuff = this.material(0xf0eee6, 0.75);
    const sleeve = this.material(0x191b1a, 0.86);

    const make = (side) => {
      const group = new THREE.Group();

      const sleeveMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.2, 1.55),
        sleeve
      );
      sleeveMesh.position.z = -0.7;

      const cuffMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.22, 0.32),
        cuff
      );
      cuffMesh.position.z = 0.05;

      const palm = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.22, 0.74),
        glove
      );
      palm.position.z = 0.5;

      [sleeveMesh, cuffMesh, palm].forEach((mesh) => {
        mesh.castShadow = true;
        group.add(mesh);
      });

      for (let index = 0; index < 4; index += 1) {
        const finger = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.065, 0.38, 5, 8),
          glove
        );
        finger.rotation.x = Math.PI / 2;
        finger.position.set((index - 1.5) * 0.13, -0.01, 0.93);
        finger.castShadow = true;
        group.add(finger);
      }

      group.position.set(side * 1.25, 0.5, -4.25);
      group.rotation.y = side * -0.08;
      this.root.add(group);
      return group;
    };

    this.leftHand = make(-1);
    this.rightHand = make(1);
  }

  buildProps() {
    const dealerButton = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.08, 32),
      this.material(0xd0a33d, 0.24, 0.82)
    );
    dealerButton.position.set(-3.05, 0.12, -1.7);
    dealerButton.castShadow = true;
    this.root.add(dealerButton);

    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.28, 0.72, 28),
      new THREE.MeshPhysicalMaterial({
        color: 0xb87333,
        roughness: 0.08,
        transmission: 0.35,
        transparent: true,
        opacity: 0.72
      })
    );
    glass.position.set(3.15, 0.4, -1.72);
    glass.castShadow = true;
    this.root.add(glass);
  }

  wrap(context, text, maxWidth, maxLines) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (context.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
        if (lines.length === maxLines - 1) break;
      } else {
        line = test;
      }
    }

    if (line && lines.length < maxLines) lines.push(line);
    return lines;
  }

  cardTexture(fact, backSide) {
    const canvas = document.createElement("canvas");
    canvas.width = 1500;
    canvas.height = 960;
    const context = canvas.getContext("2d");

    const gradient = context.createLinearGradient(0, 0, 1500, 960);
    gradient.addColorStop(0, "#fffdf6");
    gradient.addColorStop(1, "#e9dec4");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "#b49348";
    context.lineWidth = 18;
    context.strokeRect(32, 32, 1436, 896);

    context.strokeStyle = "rgba(28, 35, 31, .18)";
    context.lineWidth = 3;
    context.strokeRect(58, 58, 1384, 844);
    context.textAlign = "center";

    if (!backSide) {
      context.fillStyle = "#687267";
      context.font = "800 46px Inter";
      context.textAlign = "left";
      context.fillText(fact.category.toUpperCase(), 96, 112);

      context.textAlign = "right";
      context.fillText(
        ["", "COMMON", "TRICKY", "DEEP CUT"][fact.difficulty] || "TRICKY",
        1404,
        112
      );

      context.textAlign = "center";
      context.fillStyle = "#1c211e";
      context.font = "900 91px Inter";
      const lines = this.wrap(context, fact.text, 1240, 5);
      const lineHeight = 108;
      const start = 455 - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, index) => {
        context.fillText(line, 750, start + index * lineHeight);
      });

      context.fillStyle = "#788078";
      context.font = "900 34px Inter";
      context.fillText("TRUE OR FALSE?", 750, 858);
    } else {
      const answerColor = fact.answer ? "#126b3a" : "#a72929";
      context.fillStyle = answerColor;
      context.font = "400 230px Bebas Neue";
      context.fillText(fact.answer ? "TRUE" : "FALSE", 750, 280);

      context.strokeStyle = answerColor;
      context.lineWidth = 11;
      context.strokeRect(430, 74, 640, 255);

      context.fillStyle = "#262d29";
      context.font = "800 53px Inter";
      const lines = this.wrap(context, fact.explanation, 1240, 7);
      lines.forEach((line, index) => {
        context.fillText(line, 750, 495 + index * 69);
      });

      context.fillStyle = "#7d836f";
      context.font = "900 30px Inter";
      context.fillText("THE HOUSE HAS SPOKEN", 750, 885);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(
      8,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    texture.needsUpdate = true;
    return texture;
  }

  async dealFact(fact) {
    this.resetZones();
    this.cardFlip.rotation.x = 0;
    this.cardOuter.position.set(0, 1.2, -4.6);
    this.cardOuter.rotation.set(0.12, -0.03, -0.05);
    this.cardOuter.scale.setScalar(0.88);

    if (this.frontMaterial.map) this.frontMaterial.map.dispose();
    if (this.backMaterial.map) this.backMaterial.map.dispose();

    this.frontMaterial.map = this.cardTexture(fact, false);
    this.backMaterial.map = this.cardTexture(fact, true);
    this.frontMaterial.needsUpdate = true;
    this.backMaterial.needsUpdate = true;

    await Promise.all([
      this.tween(720, (progress) => {
        const eased = easeOut(progress);
        this.cardOuter.position.set(
          0,
          1.2 * (1 - eased) + 0.2 * eased,
          -4.4 * (1 - eased) - 0.48 * eased
        );
        this.cardOuter.scale.setScalar(0.88 + 0.12 * eased);
        this.cardOuter.rotation.z = -0.07 + 0.07 * eased;
      }),
      this.tween(520, (progress) => {
        this.rightHand.position.z =
          -4.25 + 1.48 * Math.sin(easeInOut(progress) * Math.PI);
      })
    ]);

    this.rightHand.position.z = -4.25;
  }

  arrangePot(percent) {
    const count = Math.max(3, Math.round(this.potChips.length * percent));
    const stackCount = Math.ceil(count / 4);

    this.potChips.forEach((chip, index) => {
      chip.visible = index < count;
      if (!chip.visible) return;

      const stack = Math.floor(index / 4);
      const level = index % 4;
      chip.position.set(
        (stack - (stackCount - 1) / 2) * 0.5,
        level * 0.083,
        0
      );
      chip.rotation.y = index * 0.23;
      chip.scale.setScalar(1);
    });

    const hiddenPlayerCount = Math.round(this.playerChips.length * percent);
    this.playerChips.forEach((chip, index) => {
      chip.visible = index >= hiddenPlayerCount;
    });
  }

  async setWager(percent) {
    this.arrangePot(percent);

    this.potGroup.position.set(0, 0.1, 2.45);
    this.potGroup.scale.setScalar(0.82);
    this.potGroup.rotation.set(0, 0, 0);

    await this.tween(430, (progress) => {
      const eased = easeInOut(progress);
      this.potGroup.position.z = 2.45 + (1.52 - 2.45) * eased;
      this.potGroup.position.y = 0.1 + Math.sin(progress * Math.PI) * 0.46;
      this.potGroup.scale.setScalar(0.82 + 0.18 * easeOut(progress));
    });

    this.potGroup.position.set(0, 0.09, 1.52);
    this.potGroup.scale.setScalar(1);

    if (percent === 1) {
      this.fx.allIn = 1;
      await this.tween(260, (progress) => {
        this.potGroup.rotation.y = Math.sin(progress * Math.PI) * 0.07;
      });
      this.potGroup.rotation.y = 0;
    }
  }

  async chooseAnswer(choice) {
    this.resetZones();

    const selected = this.zones[choice ? "true" : "false"];
    selected.frame.material.opacity = 0.92;
    selected.zone.scale.setScalar(1.05);
    this.selectionLight.intensity = 13;
    this.selectionLight.position.x = choice ? 2 : -2;

    const targetX = choice ? 2 : -2;
    const startX = this.potGroup.position.x;
    const startZ = this.potGroup.position.z;

    await this.tween(540, (progress) => {
      const eased = easeInOut(progress);
      this.potGroup.position.x = startX + (targetX - startX) * eased;
      this.potGroup.position.z = startZ + (0.78 - startZ) * eased;
      this.potGroup.position.y = 0.08 + Math.sin(progress * Math.PI) * 0.42;
      this.potGroup.rotation.z =
        Math.sin(progress * Math.PI) * (choice ? -0.1 : 0.1);
    });

    this.potGroup.position.y = 0.08;
    this.potGroup.rotation.z = 0;
  }

  resetZones() {
    Object.values(this.zones).forEach((zone) => {
      zone.frame.material.opacity = 0;
      zone.zone.scale.setScalar(1);
    });
    this.selectionLight.intensity = 0;
  }

  countdownSprite(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");

    const gradient = context.createRadialGradient(
      180,
      145,
      20,
      256,
      256,
      230
    );
    gradient.addColorStop(0, "#fff2b6");
    gradient.addColorStop(0.42, "#d6a536");
    gradient.addColorStop(1, "#4a2d08");

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(256, 256, 218, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(255,255,255,.72)";
    context.lineWidth = 8;
    context.stroke();

    context.fillStyle = "#1d1405";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font =
      text === "REVEAL"
        ? "400 106px Bebas Neue"
        : "400 238px Bebas Neue";
    context.fillText(text, 256, 270);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false
      })
    );

    const base = text === "REVEAL" ? 2.72 : 1.82;
    sprite.userData.baseScale = base;
    sprite.scale.set(base, base, 1);
    sprite.position.set(0, 2.45, -0.55);
    return sprite;
  }

  async dramaticCountdown(onBeat) {
    const values = ["3", "2", "1", "REVEAL"];
    const startCamera = this.cameraAnchor.clone();
    const endCamera = this.cameraHome.clone().add(
      new THREE.Vector3(0, -0.16, -0.52)
    );

    this.key.intensity = 68;
    this.fill.intensity = 12;

    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];

      if (this.counter) {
        this.scene.remove(this.counter);
        this.counter.material.map.dispose();
        this.counter.material.dispose();
      }

      this.counter = this.countdownSprite(value);
      this.scene.add(this.counter);
      onBeat?.(value);

      const duration = value === "REVEAL" ? 760 : 690;

      await this.tween(duration, (progress) => {
        const globalProgress = (index + progress) / values.length;
        const cameraEase = easeInOut(globalProgress);

        this.cameraAnchor.lerpVectors(
          startCamera,
          endCamera,
          cameraEase
        );

        const base = this.counter.userData.baseScale;
        const entrance = Math.min(1, progress / 0.28);
        const gentleScale = base * (0.9 + 0.1 * easeOut(entrance));
        this.counter.scale.set(gentleScale, gentleScale, 1);

        if (progress < 0.18) {
          this.counter.material.opacity = progress / 0.18;
        } else if (progress > 0.76) {
          this.counter.material.opacity = 1 - (progress - 0.76) / 0.24;
        } else {
          this.counter.material.opacity = 1;
        }

        this.cardOuter.position.y =
          0.2 + Math.sin(progress * Math.PI) * 0.025;
      });
    }

    if (this.counter) {
      this.scene.remove(this.counter);
      this.counter.material.map.dispose();
      this.counter.material.dispose();
      this.counter = null;
    }

    this.cameraAnchor.copy(endCamera);
    this.cardOuter.position.y = 0.2;
  }

  async revealCard(correct) {
    // The result card finishes in a readable "dealer presentation" pose:
    // lifted above the rail, moved toward the player, and tilted at the camera.
    const revealCamera = this.cameraHome.clone().add(
      new THREE.Vector3(0, -0.22, -0.46)
    );
    const revealFocus = new THREE.Vector3(0, 0.82, 0.18);

    const cameraStart = this.cameraAnchor.clone();
    const focusStart = this.focusAnchor.clone();
    const positionStart = this.cardOuter.position.clone();
    const scaleStart = this.cardOuter.scale.x;

    const resultPosition = new THREE.Vector3(0, 1.18, 0.12);
    const resultScale = 1.12;
    const resultTilt = 0.38;

    await Promise.all([
      this.tween(980, (progress) => {
        const eased = easeInOut(progress);

        // Flip the card while lifting it into its final readable pose.
        this.cardFlip.rotation.x = Math.PI * eased;
        this.cardOuter.position.lerpVectors(
          positionStart,
          resultPosition,
          eased
        );
        this.cardOuter.position.y +=
          Math.sin(progress * Math.PI) * 0.38;

        this.cardOuter.rotation.x = resultTilt * eased;
        this.cardOuter.rotation.z =
          Math.sin(progress * Math.PI) * -0.028;

        const scale =
          scaleStart + (resultScale - scaleStart) * eased;
        this.cardOuter.scale.setScalar(scale);
      }),
      this.tween(980, (progress) => {
        const eased = easeInOut(progress);

        this.leftHand.position.z =
          -4.25 + 1.9 * Math.sin(eased * Math.PI);
        this.leftHand.position.x =
          -1.25 + 0.32 * Math.sin(eased * Math.PI);

        this.cameraAnchor.lerpVectors(
          cameraStart,
          revealCamera,
          eased
        );
        this.focusAnchor.lerpVectors(
          focusStart,
          revealFocus,
          eased
        );
      })
    ]);

    // Hold the card above the rail until the player advances.
    this.cardOuter.position.copy(resultPosition);
    this.cardOuter.rotation.set(resultTilt, 0, 0);
    this.cardOuter.scale.setScalar(resultScale);

    this.leftHand.position.set(-1.25, 0.5, -4.25);
    this.cameraAnchor.copy(revealCamera);
    this.focusAnchor.copy(revealFocus);

    this.fx[correct ? "win" : "lose"] = 1;
    this.key.color.setHex(correct ? 0xffd66e : 0xff5b5b);
    this.fill.color.setHex(correct ? 0x65d995 : 0x701c1c);
  }

  async resolveChips(correct) {
    const start = this.potGroup.position.clone();

    if (correct) {
      await this.tween(720, (progress) => {
        const eased = easeOut(progress);
        this.potGroup.position.x = start.x * (1 - eased);
        this.potGroup.position.z =
          start.z + (3.0 - start.z) * eased;
        this.potGroup.position.y =
          0.08 + Math.sin(progress * Math.PI) * 0.54;
        this.potGroup.rotation.y =
          Math.sin(progress * Math.PI) * 0.42;
      });
    } else {
      await this.tween(700, (progress) => {
        const eased = easeInOut(progress);
        this.potGroup.position.x = start.x * (1 - eased);
        this.potGroup.position.z =
          start.z + (-4.7 - start.z) * eased;
        this.potGroup.position.y =
          0.08 + Math.sin(progress * Math.PI) * 0.28;
        this.rightHand.position.z =
          -4.25 + 1.7 * Math.sin(progress * Math.PI);
      });
    }

    this.potChips.forEach((chip) => {
      chip.visible = false;
      chip.scale.setScalar(1);
    });
    this.playerChips.forEach((chip) => {
      chip.visible = true;
    });

    this.potGroup.position.set(0, 0.09, 1.52);
    this.potGroup.rotation.set(0, 0, 0);
    this.rightHand.position.z = -4.25;
  }

  async resetRound() {
    this.resetZones();
    this.key.color.setHex(0xffd77e);
    this.fill.color.setHex(0x66bd91);
    this.key.intensity = 76;
    this.fill.intensity = 24;
    this.red.intensity = 4;

    this.cameraAnchor.copy(this.cameraHome);
    this.focusAnchor.set(0, 0.08, 0.45);

    this.cardFlip.rotation.x = 0;
    this.cardOuter.position.set(0, 0.22, -0.48);
    this.cardOuter.rotation.set(0.12, 0, 0);
    this.cardOuter.scale.setScalar(1);

    this.potGroup.position.set(0, 0.09, 1.52);
    this.potGroup.rotation.set(0, 0, 0);
    this.potGroup.scale.setScalar(1);

    this.potChips.forEach((chip) => {
      chip.visible = false;
      chip.scale.setScalar(1);
    });
    this.playerChips.forEach((chip) => {
      chip.visible = true;
    });

    await this.tween(260, () => {});
  }

  setSkin(skin) {
    const skins = {
      "": { face: 0xffffff, side: 0xc2b495 },
      blueprint: { face: 0x739bd0, side: 0x173d6b },
      gold: { face: 0xc49a3d, side: 0x4b300a },
      cyber: { face: 0x31536f, side: 0x08151f }
    };

    const selected = skins[skin] || skins[""];
    this.frontMaterial.color.setHex(selected.face);
    this.backMaterial.color.setHex(selected.face);
    this.cardBaseMaterial.color.setHex(selected.side);
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
    if (rect.width < 2 || rect.height < 2) return;

    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.fov = this.camera.aspect < 0.72 ? 47 : 43;
    this.camera.updateProjectionMatrix();

    const scale =
      this.camera.aspect < 0.62
        ? 0.86
        : this.camera.aspect < 0.78
          ? 0.93
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

    const desired = this.cameraAnchor.clone();
    if (!this.tweens.length) {
      desired.x += Math.sin(elapsed * 0.27) * 0.025;
      desired.y += Math.sin(elapsed * 0.38) * 0.015;
    }

    if (this.fx.lose > 0.02) {
      desired.x +=
        Math.sin(elapsed * 62) * this.fx.lose * 0.045;
      desired.y +=
        Math.cos(elapsed * 58) * this.fx.lose * 0.022;
    }

    this.camera.position.lerp(desired, 0.13);
    this.camera.lookAt(this.focusAnchor);

    this.key.intensity =
      76 +
      this.fx.win * 28 -
      this.fx.lose * 10;

    this.renderer.render(this.scene, this.camera);
  };
}
