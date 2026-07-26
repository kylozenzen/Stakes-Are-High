
import { HST_FACTS } from "./facts.js";
import { HighStakesTable } from "./three-table.js";

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const views = [...document.querySelectorAll(".view")];

  const state = {
    balance: 1000,
    wager: 0.5,
    round: 0,
    max: 10,
    daily: false,
    deck: [],
    fact: null,
    active: false,
    transitioning: false,
    correct: 0,
    streak: 0,
    best: 0,
    risk: 0,
    modifier: null,
    career: Number(localStorage.getItem("hst_career")) || 0,
    tokens: Number(localStorage.getItem("hst_tokens")) || 0,
    dailyStreak: Number(localStorage.getItem("hst_daily_streak")) || 0,
    lastDaily: localStorage.getItem("hst_last_daily") || "",
    name: localStorage.getItem("hst_name") || "Player",
    avatar: localStorage.getItem("hst_avatar") || "🎲",
    inventory: JSON.parse(
      localStorage.getItem("hst_inventory") || '[""]'
    ),
    skin: localStorage.getItem("hst_skin") || "",
    sound: localStorage.getItem("hst_sound") === "1",
    stats: JSON.parse(
      localStorage.getItem("hst_stats") ||
      '{"games":0,"wins":0,"correct":0,"bestBank":0,"allIns":0}'
    )
  };

  let table;
  let balanceAnimationFrame = 0;

  class SoundFX {
    constructor() {
      this.context = null;
    }

    init() {
      if (!this.context) {
        this.context = new (
          window.AudioContext || window.webkitAudioContext
        )();
      }
      if (this.context.state === "suspended") {
        this.context.resume().catch(() => {});
      }
    }

    tone(
      frequency,
      duration = 0.08,
      type = "sine",
      volume = 0.05,
      delay = 0
    ) {
      if (!state.sound) return;
      this.init();

      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(
        frequency,
        this.context.currentTime + delay
      );
      gain.gain.setValueAtTime(
        volume,
        this.context.currentTime + delay
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        this.context.currentTime + delay + duration
      );

      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(this.context.currentTime + delay);
      oscillator.stop(
        this.context.currentTime + delay + duration
      );
    }

    click() { this.tone(420, 0.08); }
    chip() { this.tone(770, 0.05, "square", 0.025); }

    countdown(value) {
      const frequency = {
        "3": 430,
        "2": 555,
        "1": 690,
        REVEAL: 900
      }[value] || 500;

      this.tone(
        frequency,
        value === "REVEAL" ? 0.17 : 0.09,
        "triangle",
        0.065
      );
    }

    win() {
      [523, 659, 784, 1047].forEach((frequency, index) => {
        this.tone(
          frequency,
          0.32,
          "triangle",
          0.07,
          index * 0.08
        );
      });
    }

    lose() {
      this.tone(175, 0.42, "sawtooth", 0.08);
      this.tone(128, 0.48, "sawtooth", 0.06, 0.1);
    }
  }

  const sound = new SoundFX();

  function openView(name) {
    const targetId = `view-${name}`;
    views.forEach((view) => {
      view.classList.toggle("active", view.id === targetId);
    });

    if (name === "home") refreshHome();
    if (name === "profile") renderProfile();
    if (name === "shop") renderShop();
    if (name === "stats") renderStats();
  }

  function setInteractionLock(locked) {
    state.transitioning = locked;
    $("quitButton").disabled = locked;
    $("nextButton").disabled = locked;
  }

  function localDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function seeded(seed) {
    let hash = 2166136261;

    for (const character of seed) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }

    return () => {
      hash += 0x6d2b79f5;
      let value = hash;
      value = Math.imul(
        value ^ (value >>> 15),
        value | 1
      );
      value ^= value + Math.imul(
        value ^ (value >>> 7),
        value | 61
      );
      return (
        ((value ^ (value >>> 14)) >>> 0) /
        4294967296
      );
    };
  }

  function shuffle(items, random = Math.random) {
    const result = [...items];

    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(
        random() * (index + 1)
      );
      [result[index], result[swapIndex]] = [
        result[swapIndex],
        result[index]
      ];
    }

    return result;
  }

  function difficulty(value) {
    return { 1: 1, 2: 1.25, 3: 1.5 }[value] || 1;
  }

  function difficultyName(value) {
    return {
      1: "Common",
      2: "Tricky",
      3: "Deep Cut"
    }[value] || "Tricky";
  }

  function streakMultiplier() {
    return Math.min(
      2,
      1 + Math.max(0, state.streak - 1) * 0.15
    );
  }

  function currentModifier() {
    if (state.round === 4) {
      return {
        name: "House Tax",
        text: "Minimum wager is 50%.",
        min: 0.5,
        bonus: 1
      };
    }

    if (state.round === 7) {
      return {
        name: "Double Trouble",
        text: "Payouts and losses are doubled.",
        min: 0.25,
        bonus: 2
      };
    }

    if (state.round === state.max) {
      return {
        name: "Final Table",
        text: "The final claim pays an extra 50%.",
        min: 0.25,
        bonus: 1.5
      };
    }

    return null;
  }

  async function startGame(daily) {
    if (state.transitioning) return;

    setInteractionLock(true);
    sound.click();

    Object.assign(state, {
      daily,
      max: daily ? 5 : 10,
      balance: 1000,
      wager: 0.5,
      round: 0,
      correct: 0,
      streak: 0,
      best: 0,
      risk: 0,
      modifier: null
    });

    state.deck = shuffle(
      HST_FACTS,
      daily ? seeded(localDate()) : Math.random
    ).slice(0, state.max);

    $("balanceDisplay").textContent = "$1,000";
    $("streakDisplay").textContent = "";
    openView("game");

    try {
      await loadNextRound();
    } finally {
      setInteractionLock(false);
    }
  }

  async function loadNextRound() {
    if (state.balance <= 0 || state.round >= state.max) {
      finish();
      return;
    }

    state.round += 1;
    state.fact = state.deck[state.round - 1];
    state.active = false;
    state.modifier = currentModifier();

    $("roundDisplay").textContent =
      `${state.round}/${state.max}`;
    $("categoryDisplay").textContent =
      state.fact.category;
    $("difficultyDisplay").textContent =
      `${difficultyName(state.fact.difficulty)} · ` +
      `${difficulty(state.fact.difficulty)}×`;
    $("claimText").textContent = state.fact.text;

    $("claimAccessibility").classList.remove("minimized");
    $("resultReadout").classList.add("hidden");
    $("countdownHud").classList.add("hidden");
    $("wagerPanel").classList.remove("hidden");
    $("answerPanel").classList.remove("hidden");
    $("nextButton").classList.add("hidden");

    $("modifierBanner").classList.toggle(
      "hidden",
      !state.modifier
    );

    if (state.modifier) {
      $("modifierName").textContent =
        state.modifier.name;
      $("modifierText").textContent =
        state.modifier.text;

      if (state.wager < state.modifier.min) {
        state.wager = state.modifier.min;
      }
    }

    updateWagerButtons();
    await table.resetRound();
    table.setSkin(state.skin);
    await table.dealFact(state.fact);
    await table.setWager(state.wager);
    state.active = true;
  }

  async function nextRound() {
    if (state.transitioning) return;

    setInteractionLock(true);
    try {
      await loadNextRound();
    } finally {
      setInteractionLock(false);
    }
  }

  async function setWager(percent) {
    if (!state.active || state.transitioning) return;

    state.wager = Math.max(
      percent,
      state.modifier?.min || 0.25
    );
    updateWagerButtons();
    sound.chip();

    state.active = false;
    setInteractionLock(true);

    try {
      await table.setWager(state.wager);
    } finally {
      state.active = true;
      setInteractionLock(false);
    }
  }

  function updateWagerButtons() {
    document.querySelectorAll("[data-wager]").forEach((button) => {
      button.classList.toggle(
        "active",
        Number(button.dataset.wager) === state.wager
      );
    });

    const wager = Math.max(
      1,
      Math.floor(state.balance * state.wager)
    );
    $("wagerDisplay").textContent =
      `$${wager.toLocaleString("en-US")}`;
  }

  async function answer(choice) {
    if (!state.active || state.transitioning) return;

    state.active = false;
    setInteractionLock(true);

    const wager = Math.max(
      1,
      Math.floor(state.balance * state.wager)
    );

    state.risk += state.wager;
    if (state.wager === 1) {
      state.stats.allIns += 1;
    }

    $("wagerPanel").classList.add("hidden");
    $("answerPanel").classList.add("hidden");
    $("view-game").classList.add("is-resolving");
    $("countdownHud").classList.remove("hidden");
    $("countdownBar").classList.remove("running");
    void $("countdownBar").offsetWidth;
    $("countdownBar").classList.add("running");

    try {
      await table.chooseAnswer(choice);
      await table.dramaticCountdown((value) => {
        const countdownNumber = $("countdownNumber");
        countdownNumber.textContent = value;
        countdownNumber.classList.remove("beat");
        void countdownNumber.offsetWidth;
        countdownNumber.classList.add("beat");
        sound.countdown(value);
      });

      const correct = choice === state.fact.answer;
      const multiplier =
        difficulty(state.fact.difficulty) *
        streakMultiplier() *
        (state.modifier?.bonus || 1);

      if (correct) {
        state.balance += Math.floor(wager * multiplier);
        state.correct += 1;
        state.streak += 1;
        state.best = Math.max(state.best, state.streak);
        sound.win();
      } else {
        state.balance -= Math.min(
          state.balance,
          Math.floor(
            wager * (state.modifier?.bonus || 1)
          )
        );
        state.streak = 0;
        sound.lose();
      }

      await table.revealCard(correct);
      animateBalance(state.balance);

      $("streakDisplay").textContent =
        state.streak >= 2
          ? `Hot hand ×${streakMultiplier().toFixed(2)}`
          : "";

      $("countdownHud").classList.add("hidden");
      $("claimAccessibility").classList.add("minimized");
      $("resultStamp").textContent =
        state.fact.answer ? "TRUE" : "FALSE";
      $("resultStamp").style.color =
        correct ? "var(--green)" : "var(--red)";
      $("explanationText").textContent =
        state.fact.explanation;
      $("resultReadout").classList.remove("hidden");

      await table.resolveChips(correct);

      $("nextButton").textContent =
        state.balance <= 0 ||
        state.round >= state.max
          ? "See results"
          : "Next claim";
      $("nextButton").classList.remove("hidden");
    } finally {
      $("view-game").classList.remove("is-resolving");
      setInteractionLock(false);
    }
  }

  function animateBalance(target) {
    cancelAnimationFrame(balanceAnimationFrame);

    const element = $("balanceDisplay");
    const start =
      Number(element.textContent.replace(/\D/g, "")) || 0;
    const startedAt = performance.now();

    const frame = (now) => {
      const progress = Math.min(
        1,
        (now - startedAt) / 500
      );
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(
        start + (target - start) * eased
      );

      element.textContent =
        `$${current.toLocaleString("en-US")}`;

      if (progress < 1) {
        balanceAnimationFrame =
          requestAnimationFrame(frame);
      }
    };

    balanceAnimationFrame = requestAnimationFrame(frame);
  }

  function finish() {
    const won =
      state.balance > 0 &&
      state.round >= state.max;

    state.stats.games += 1;
    state.stats.wins += won ? 1 : 0;
    state.stats.correct += state.correct;
    state.stats.bestBank = Math.max(
      state.stats.bestBank,
      state.balance
    );

    if (won) {
      state.career += state.balance;
      state.tokens += Math.max(
        100,
        Math.floor(state.balance * 0.12)
      );
      if (state.daily) updateDailyStreak();
    }

    persist();

    $("finalIcon").textContent = won ? "🏆" : "♠️";
    $("finalEyebrow").textContent =
      state.daily
        ? "Daily table complete"
        : "Run complete";
    $("finalTitle").textContent =
      won ? titleForBalance(state.balance) : "The house won";
    $("finalSubtitle").textContent =
      won
        ? "You walked away while you still could."
        : "One claim too far.";
    $("finalBank").textContent =
      `$${state.balance.toLocaleString("en-US")}`;
    $("finalCorrect").textContent =
      `${state.correct}/${state.max}`;
    $("finalBest").textContent = state.best;
    $("finalRisk").textContent = riskLabel();

    openView("result");
  }

  function updateDailyStreak() {
    const today = localDate();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(
      yesterdayDate.getDate() - 1
    );

    if (state.lastDaily === today) return;

    state.dailyStreak =
      state.lastDaily === localDate(yesterdayDate)
        ? state.dailyStreak + 1
        : 1;
    state.lastDaily = today;
  }

  function titleForBalance(balance) {
    if (balance >= 10000) return "Untouchable";
    if (balance >= 6000) return "Beat the house";
    if (balance >= 3000) return "High roller";
    return "Walked away";
  }

  function riskLabel() {
    const average =
      state.risk / Math.max(1, state.round);
    if (average > 0.8) return "Reckless";
    if (average > 0.55) return "Bold";
    return "Measured";
  }

  function persist() {
    localStorage.setItem("hst_career", state.career);
    localStorage.setItem("hst_tokens", state.tokens);
    localStorage.setItem(
      "hst_daily_streak",
      state.dailyStreak
    );
    localStorage.setItem(
      "hst_last_daily",
      state.lastDaily
    );
    localStorage.setItem(
      "hst_stats",
      JSON.stringify(state.stats)
    );
  }

  function share() {
    const text = [
      "♠ HIGH STAKES TRUTH",
      state.daily ? "DAILY TABLE" : "ARCADE RUN",
      `${"🟩".repeat(state.correct)}` +
        `${"⬛".repeat(
          Math.max(0, state.max - state.correct)
        )}`,
      `Bank: $${state.balance.toLocaleString("en-US")}`,
      `Risk: ${riskLabel()}`
    ].join("\n");

    navigator.clipboard
      ?.writeText(text)
      .then(() => toast("Result copied"))
      .catch(() => window.prompt("Copy your result:", text));
  }

  function refreshHome() {
    $("homeName").textContent = state.name;
    $("homeAvatar").textContent = state.avatar;
    $("homeCareer").textContent =
      `$${state.career.toLocaleString("en-US")}`;
    $("homeStreak").textContent = state.dailyStreak;
    $("homeTokens").textContent =
      state.tokens.toLocaleString("en-US");
  }

  function renderProfile() {
    $("nameInput").value = state.name;
    $("profileStreak").textContent =
      state.dailyStreak;
    $("profileCareer").textContent =
      `$${state.career.toLocaleString("en-US")}`;

    const avatars = [
      "🎲",
      "♠️",
      "🦁",
      "🤖",
      "🕵️",
      "🦊",
      "🐉",
      "👑",
      "🧠",
      "🃏"
    ];

    $("avatarGrid").innerHTML = avatars
      .map(
        (avatar) =>
          `<button class="${avatar === state.avatar ? "selected" : ""}" data-avatar="${avatar}">${avatar}</button>`
      )
      .join("");

    document.querySelectorAll("[data-avatar]").forEach((button) => {
      button.onclick = () => {
        state.avatar = button.dataset.avatar;
        localStorage.setItem(
          "hst_avatar",
          state.avatar
        );
        renderProfile();
        refreshHome();
      };
    });
  }

  const shop = [
    {
      id: "",
      name: "Classic Ivory",
      description: "The house standard.",
      cost: 0
    },
    {
      id: "blueprint",
      name: "Blueprint",
      description: "For suspiciously organized gamblers.",
      cost: 2500
    },
    {
      id: "gold",
      name: "High Roller Gold",
      description: "Tasteful? No. Powerful? Absolutely.",
      cost: 7000
    },
    {
      id: "cyber",
      name: "Neon Protocol",
      description: "Truth, but make it illegal-looking.",
      cost: 12000
    }
  ];

  function renderShop() {
    $("shopTokens").textContent =
      state.tokens.toLocaleString("en-US");

    $("shopList").innerHTML = shop
      .map((item) => {
        const owned = state.inventory.includes(item.id);
        const active = state.skin === item.id;
        const canBuy = state.tokens >= item.cost;

        return `
          <article class="shop-item">
            <div>
              <h3>${item.name}</h3>
              <p>${item.description}</p>
            </div>
            <button
              data-skin="${item.id}"
              data-cost="${item.cost}"
              class="${active ? "active" : ""}"
              ${!owned && !canBuy ? "disabled" : ""}
            >
              ${
                active
                  ? "Active"
                  : owned
                    ? "Equip"
                    : item.cost.toLocaleString("en-US")
              }
            </button>
          </article>
        `;
      })
      .join("");

    document.querySelectorAll("[data-skin]").forEach((button) => {
      button.onclick = () => {
        buySkin(
          button.dataset.skin,
          Number(button.dataset.cost)
        );
      };
    });
  }

  function buySkin(id, cost) {
    if (!state.inventory.includes(id)) {
      if (state.tokens < cost) return;
      state.tokens -= cost;
      state.inventory.push(id);
      localStorage.setItem(
        "hst_inventory",
        JSON.stringify(state.inventory)
      );
    }

    state.skin = id;
    localStorage.setItem("hst_skin", id);
    localStorage.setItem(
      "hst_tokens",
      state.tokens
    );

    table.setSkin(id);
    renderShop();
    refreshHome();
    sound.chip();
  }

  function renderStats() {
    const data = [
      ["Games", state.stats.games],
      ["Wins", state.stats.wins],
      [
        "Win rate",
        state.stats.games
          ? `${Math.round(
              (state.stats.wins / state.stats.games) * 100
            )}%`
          : "0%"
      ],
      ["Correct answers", state.stats.correct],
      [
        "Best bank",
        `$${state.stats.bestBank.toLocaleString("en-US")}`
      ],
      ["All-ins", state.stats.allIns],
      [
        "Career winnings",
        `$${state.career.toLocaleString("en-US")}`
      ],
      ["Daily streak", state.dailyStreak]
    ];

    $("statsGrid").innerHTML = data
      .map(
        ([key, value]) =>
          `<div><small>${key}</small><strong>${value}</strong></div>`
      )
      .join("");
  }

  function updateSoundState() {
    $("soundState").textContent =
      state.sound ? "On" : "Off";
    $("soundState").style.color =
      state.sound ? "var(--green)" : "var(--muted)";
  }

  function toast(message) {
    $("toast").textContent = message;
    $("toast").classList.remove("hidden");
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => {
      $("toast").classList.add("hidden");
    }, 1600);
  }

  function bind() {
    $("playButton").onclick = () => startGame(false);
    $("dailyButton").onclick = () => startGame(true);
    $("profileButton").onclick = () => openView("profile");
    $("quitButton").onclick = () => {
      if (!state.transitioning) openView("home");
    };
    $("falseButton").onclick = () => answer(false);
    $("trueButton").onclick = () => answer(true);
    $("nextButton").onclick = nextRound;
    $("replayButton").onclick = () =>
      startGame(state.daily);
    $("shareButton").onclick = share;

    document.querySelectorAll("[data-wager]").forEach((button) => {
      button.onclick = () =>
        setWager(Number(button.dataset.wager));
    });

    document.querySelectorAll("[data-open]").forEach((button) => {
      button.onclick = () =>
        openView(button.dataset.open);
    });

    document.querySelectorAll("[data-home]").forEach((button) => {
      button.onclick = () => openView("home");
    });

    $("nameInput").oninput = (event) => {
      state.name = event.target.value || "Player";
      localStorage.setItem("hst_name", state.name);
      refreshHome();
    };

    $("soundToggle").onclick = () => {
      state.sound = !state.sound;
      localStorage.setItem(
        "hst_sound",
        state.sound ? "1" : "0"
      );
      updateSoundState();
      if (state.sound) sound.click();
    };
  }

  async function initialize() {
    if (
      !Array.isArray(HST_FACTS) ||
      HST_FACTS.length < 10
    ) {
      throw new Error("facts.js did not load");
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    table = new HighStakesTable($("tableCanvas"));
    table.setSkin(state.skin);
    bind();
    refreshHome();
    updateSoundState();
  }

  window.addEventListener(
    "DOMContentLoaded",
    initialize
  );
})();
