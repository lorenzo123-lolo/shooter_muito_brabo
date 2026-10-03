// Bloco de Isaac - roguelike de salas inspirado em The Binding of Isaac.
// Visual Frutiger Aero em 2.5D. Você é um bloco de vidro. WASD move, setas atiram.
(function (global) {
  'use strict';

  // ---------- Constantes do mundo (lógica, vista de cima) ----------
  const W = 960, H = 600, HUD = 64, WALL = 40, TILE = 40;
  const IX0 = WALL, IY0 = WALL, IX1 = W - WALL, IY1 = H - WALL;
  const DOOR = 100;
  const MAX_FLOOR = 3;

  // ---------- Balanceamento ----------
  const PLAYER_DMG_BONUS = 1.30 * 1.30; // ataque do bloco: +30% e depois mais +30% (= +69%)
  const SHIELD_TIME = 10;          // escudo da tecla P dura 10 s
  const SHIELD_COOLDOWN = 20;      // e só pode ser usado de novo 20 s depois de ativado
  const PLAYER_MAX_HP = 8;         // 4 corações (cada ponto = meio coração)
  const PLAYER_SPEED_BONUS = 1.04; // velocidade do bloco +4%
  const ENEMY_HP_BONUS = 1.02;     // vida dos inimigos comuns +2% (não vale para os invocados por chefões)
  const BOSS_HP_MULT = 0.75;       // vida dos chefões -25%

  // ---------- Constantes da projeção 2.5D ----------
  const SCREEN_H = 600;     // altura do canvas
  const ROOM_Y0 = 118;      // y de tela da borda de trás da sala (no chão)
  const YSCALE = 0.74;      // achatamento vertical do chão
  const PERSP_BACK = 0.8;   // escala do fundo da sala (a frente é 1.0)
  const WALL_H = 56, FRONT_H = 20, DOOR_H = 46;
  const FONT = '"Segoe UI", "Trebuchet MS", Arial, sans-serif';

  const DIRS = {
    up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
  };
  const DIR_KEYS = Object.keys(DIRS);
  const SHOOT_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

  const ITEMS = [
    { id: 'dmg', name: 'Bloco de Chumbo', desc: 'Dano +1.5', color: '#ff5d7a',
      apply: p => { p.dmg += 1.5; } },
    { id: 'rate', name: 'Gatilho de Cristal', desc: 'Cadência de tiro +', color: '#3fc4ff',
      apply: p => { p.fireDelay = Math.max(0.12, p.fireDelay * 0.72); } },
    { id: 'speed', name: 'Rodinhas', desc: 'Velocidade +', color: '#6ee05a',
      apply: p => { p.speed += 45; } },
    { id: 'triple', name: 'Tiro Triplo', desc: 'Três bolhas por vez', color: '#ffc93c',
      apply: p => { p.triple = true; } },
    { id: 'heart', name: 'Coração de Vidro', desc: 'Vida máxima +1', color: '#ff8fc1',
      apply: p => { p.maxHp = Math.min(24, p.maxHp + 2); p.hp = Math.min(p.maxHp, p.hp + 2); } },
    { id: 'range', name: 'Lente Longa', desc: 'Alcance e velocidade do tiro +', color: '#a98bff',
      apply: p => { p.range += 0.3; p.shotSpeed += 90; } },
    // --- itens que mudam o jeito de jogar (inspirados no Isaac) ---
    { id: 'homing', name: 'Colher Entortada', desc: 'Bolhas teleguiadas', color: '#c77dff',
      apply: p => { p.homing = true; } },
    { id: 'pierce', name: 'Flecha de Cristal', desc: 'Bolhas atravessam inimigos', color: '#ff9ecf',
      apply: p => { p.pierce = true; } },
    { id: 'big', name: 'Bolhona', desc: 'Dano muito maior, bolhas gigantes e mais lentas', color: '#ff4f4f',
      apply: p => { p.dmg = p.dmg * 1.25 + 1.5; p.tearSize = 22; p.fireDelay *= 1.35; } },
    { id: 'quad', name: 'Olho Quádruplo', desc: 'Quatro bolhas por vez, mas atira mais devagar', color: '#ffa13c',
      apply: p => { p.quad = true; p.fireDelay *= 1.4; } },
    { id: 'bounce', name: 'Borracha Elástica', desc: 'Bolhas quicam nas paredes e pedras', color: '#7dffb2',
      apply: p => { p.bounce = true; } },
    { id: 'spectral', name: 'Bolha Fantasma', desc: 'Bolhas atravessam pedras', color: '#e8f4ff',
      apply: p => { p.spectral = true; } },
    { id: 'freeze', name: 'Bolha Gelada', desc: 'Bolhas deixam os inimigos lentos', color: '#9be7ff',
      apply: p => { p.freeze = true; } },
    { id: 'cricket', name: 'Cabeça de Grilo', desc: 'Dano x1.5', color: '#8fd14f',
      apply: p => { p.dmg *= 1.5; } },
    { id: 'shield', name: 'Manto de Vidro', desc: 'Bloqueia o primeiro golpe de cada sala', color: '#ffffff',
      apply: p => { p.shield = true; p.shieldUp = true; } },
    { id: 'vampire', name: 'Amuleto Vampiro', desc: 'Cura meio coração a cada 8 abates', color: '#b0003a',
      apply: p => { p.vampire = true; } },
    { id: 'orbital', name: 'Cubinho Orbital', desc: 'Gira ao seu redor, bloqueia tiros e machuca', color: '#ffd84a',
      apply: p => { p.orbital = true; } },
    { id: 'buddy', name: 'Irmãozinho', desc: 'Um cubinho que atira junto com você', color: '#ff7ab8',
      apply: p => { p.buddy = true; } },
    { id: 'cake', name: 'Bolo de Morango', desc: 'Vida máxima +1 e cura tudo', color: '#ffb3c7',
      apply: p => { p.maxHp = Math.min(24, p.maxHp + 2); p.hp = p.maxHp; } },
  ];

  // Padrões de pedras em tiles (22 x 13). Colunas 9-12 e linhas 5-7 ficam livres.
  const PATTERNS = [
    [],
    [[4, 2], [5, 2], [4, 3], [5, 3], [16, 2], [17, 2], [16, 3], [17, 3],
     [4, 9], [5, 9], [4, 10], [5, 10], [16, 9], [17, 9], [16, 10], [17, 10]],
    [[3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [14, 3], [15, 3], [16, 3], [17, 3], [18, 3],
     [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [14, 9], [15, 9], [16, 9], [17, 9], [18, 9]],
    [[6, 2], [15, 2], [6, 10], [15, 10], [3, 4], [18, 4], [3, 8], [18, 8]],
    [[3, 2], [7, 4], [14, 4], [18, 2], [3, 10], [7, 8], [14, 8], [18, 10]],
    [[1, 1], [2, 1], [1, 2], [20, 1], [19, 1], [20, 2], [1, 11], [2, 11], [1, 10], [20, 11], [19, 11], [20, 10]],
  ];

  const ENEMY_BASE = {
    fly: { size: 18, hp: 4, speed: 95 },
    orbiter: { size: 18, hp: 5, speed: 150 },
    grunt: { size: 26, hp: 10, speed: 70 },
    turret: { size: 28, hp: 12, speed: 0 },
  };

  const BOSSES = {
    gelatao: { name: 'Gelatão', sub: 'O Cubo de Gelatina', size: 84, hp: 260, speed: 0 },
    duque: { name: 'Duque das Bolhas', sub: 'Senhor do Enxame', size: 80, hp: 230, speed: 75 },
    prisma: { name: 'Prisma', sub: 'O Cristal Laser', size: 64, hp: 280, speed: 0 },
    hipercubo: { name: 'O Hipercubo', sub: 'Chefão final', size: 92, hp: 600, speed: 0, final: true },
  };
  const BOSS_POOLS = { 1: ['gelatao', 'duque'], 2: ['prisma', 'gelatao', 'duque'], 3: ['hipercubo'] };

  const BIOMES = [
    { id: 'lagoa', name: 'Lagoa de Vidro', tileA: [196, 242, 255], tileB: [130, 212, 246], grout: '#f2fdff',
      wallA: '#f6feff', wallB: '#5fbfe8', wallTop: '#9be86e', wallTopB: '#45ad35',
      rock: { top: '#f4fdff', front: '#6fc0e8', side: '#2f8fc4', alpha: 0.92 } },
    { id: 'prado', name: 'Prado Brilhante', tileA: [196, 246, 150], tileB: [126, 214, 96], grout: '#f4ffe8',
      wallA: '#fbfff2', wallB: '#6fcf5a', wallTop: '#c8f59a', wallTopB: '#4caf2f',
      rock: { top: '#ecfff6', front: '#8fe0b4', side: '#4fb67e', alpha: 0.95 } },
    { id: 'ceu', name: 'Céu Cromado', tileA: [230, 238, 255], tileB: [176, 198, 255], grout: '#ffffff',
      wallA: '#ffffff', wallB: '#8aa2f0', wallTop: '#ffffff', wallTopB: '#b5c6ff',
      rock: { top: '#ffffff', front: '#cdd6f2', side: '#93a3d4', alpha: 0.95 } },
  ];

  // ---------- Utilidades ----------
  function makeRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rk = (x, y) => x + ',' + y;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const TAU = Math.PI * 2;

  function overlap(a, b) {
    const r = (a.size + b.size) / 2;
    return Math.abs(a.x - b.x) < r && Math.abs(a.y - b.y) < r;
  }

  function hitsRock(room, x, y, h) {
    for (const r of room.rocks) {
      if (x + h > r.x && x - h < r.x + r.w && y + h > r.y && y - h < r.y + r.h) return r;
    }
    return null;
  }

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    const cx = ax + dx * t, cy = ay + dy * t;
    return { d: Math.hypot(px - cx, py - cy), x: cx, y: cy };
  }

  function curRoom(s) { return s.rooms[rk(s.cur.x, s.cur.y)]; }
  function biome(s) { return BIOMES[Math.min(BIOMES.length, s.floor) - 1]; }

  // Projeção 2.5D: mundo (x, y no chão, z altura) -> tela
  function sc(y) { return PERSP_BACK + (1 - PERSP_BACK) * (y / H); }
  function proj(x, y, z) {
    const k = sc(y);
    return { x: W / 2 + (x - W / 2) * k, y: ROOM_Y0 + y * YSCALE - (z || 0) * k };
  }

  // ---------- Criação ----------
  function makePlayer() {
    return {
      x: W / 2, y: H / 2, size: 30, vx: 0, vy: 0, speed: 210 * PLAYER_SPEED_BONUS,
      hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, dmg: 3.5 * PLAYER_DMG_BONUS, fireDelay: 0.38, cd: 0, shotSpeed: 430, range: 0.85,
      inv: 0, triple: false, items: [], face: 'down',
      tearSize: 12, quad: false, homing: false, pierce: false, bounce: false, spectral: false, freeze: false,
      shieldTime: 0, shieldCd: 0,
      shield: false, shieldUp: false, vampire: false, vampKills: 0, orbital: false, buddy: false,
    };
  }

  function newRoom(x, y, type) {
    return {
      x, y, type, doors: {}, rocks: [], spawns: [], enemies: [], pickups: [],
      item: null, trapdoor: null, visited: false, cleared: type === 'start',
    };
  }

  function makeEnemy(s, sp) {
    if (sp.type === 'boss') return makeBoss(s, sp);
    const b = ENEMY_BASE[sp.type];
    const m = (1 + 0.35 * (s.floor - 1)) * (sp.summoned ? 1 : ENEMY_HP_BONUS);
    return {
      type: sp.type, x: sp.x, y: sp.y, z: 0, size: b.size, hp: b.hp * m, maxHp: b.hp * m,
      speed: b.speed * (1 + 0.1 * (s.floor - 1)), t: s.rng() * 2, cd: 1 + s.rng(),
      flash: 0, kx: 0, ky: 0, vx: 0, vy: 0, air: false, ang: 0, launched: false, parent: null,
    };
  }

  function makeBoss(s, sp) {
    const def = BOSSES[sp.kind];
    const m = (def.final ? 1 : 1 + 0.4 * (s.floor - 1)) * BOSS_HP_MULT;
    return {
      type: 'boss', kind: sp.kind, name: def.name, x: sp.x, y: sp.y, z: 0, size: def.size,
      hp: def.hp * m, maxHp: def.hp * m, speed: def.speed, t: 0, state: 'idle', timer: 1.2,
      flash: 0, kx: 0, ky: 0, vx: 0, vy: 0, air: false, shield: false, squash: 0, alpha: 1,
      spin: 0, phase: 1, cycle: 0, emit: 0, shots: 0, cang: 0,
    };
  }

  function pickItemId(s) {
    const owned = new Set(s.player.items);
    let pool = ITEMS.filter(i => !owned.has(i.id));
    if (!pool.length) pool = ITEMS.filter(i => i.id !== 'triple');
    return pool[Math.floor(s.rng() * pool.length)].id;
  }

  function pickBoss(s) {
    const base = BOSS_POOLS[Math.min(MAX_FLOOR, s.floor)];
    let pool = base.filter(k => !s.usedBosses.includes(k));
    if (!pool.length) pool = base;
    const kind = pool[Math.floor(s.rng() * pool.length)];
    s.usedBosses.push(kind);
    return kind;
  }

  function populate(s, room) {
    const rng = s.rng;
    if (room.type === 'start') return;
    if (room.type === 'item') {
      room.item = { x: W / 2, y: H / 2, size: 30, id: pickItemId(s), taken: false };
      room.cleared = true;
      return;
    }
    if (room.type === 'boss') {
      room.bossKind = pickBoss(s);
      room.spawns.push({ type: 'boss', kind: room.bossKind, x: W / 2, y: H / 2 - 90 });
      return;
    }
    const pattern = PATTERNS[Math.floor(rng() * PATTERNS.length)];
    room.rocks = pattern.map(([c, r]) => ({ x: IX0 + c * TILE, y: IY0 + r * TILE, w: TILE, h: TILE, c, r }));
    const taken = new Set(pattern.map(([c, r]) => c + ',' + r));
    const count = Math.min(8, 2 + s.floor + Math.floor(rng() * 3));
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 60; tries++) {
        const c = 4 + Math.floor(rng() * 14), r = 2 + Math.floor(rng() * 9);
        if (taken.has(c + ',' + r)) continue;
        taken.add(c + ',' + r);
        const roll = rng();
        const type = roll < 0.4 ? 'fly' : roll < 0.75 ? 'grunt' : 'turret';
        room.spawns.push({ type, x: IX0 + c * TILE + TILE / 2, y: IY0 + r * TILE + TILE / 2, c, r });
        break;
      }
    }
  }

  function generateFloor(s) {
    const rng = s.rng;
    const target = 7 + s.floor * 2;
    const rooms = {};
    const list = [];
    const add = (x, y, type) => { const r = newRoom(x, y, type); rooms[rk(x, y)] = r; list.push(r); return r; };
    add(0, 0, 'start');
    let guard = 0;
    while (list.length < target && guard++ < 20000) {
      const base = list[Math.floor(rng() * list.length)];
      const d = DIRS[DIR_KEYS[Math.floor(rng() * 4)]];
      const nx = base.x + d.dx, ny = base.y + d.dy;
      if (rooms[rk(nx, ny)]) continue;
      let nb = 0;
      for (const k of DIR_KEYS) if (rooms[rk(nx + DIRS[k].dx, ny + DIRS[k].dy)]) nb++;
      if (nb > 1) continue; // mapa em árvore, com becos sem saída
      add(nx, ny, 'normal');
    }
    for (const r of list) {
      for (const k of DIR_KEYS) if (rooms[rk(r.x + DIRS[k].dx, r.y + DIRS[k].dy)]) r.doors[k] = true;
    }
    const dist = { [rk(0, 0)]: 0 };
    const queue = [rooms[rk(0, 0)]];
    while (queue.length) {
      const r = queue.shift();
      for (const k in r.doors) {
        const n = rooms[rk(r.x + DIRS[k].dx, r.y + DIRS[k].dy)];
        if (dist[rk(n.x, n.y)] === undefined) { dist[rk(n.x, n.y)] = dist[rk(r.x, r.y)] + 1; queue.push(n); }
      }
    }
    const others = list.filter(r => r.type !== 'start');
    const deadEnds = others.filter(r => Object.keys(r.doors).length === 1);
    const bossPool = (deadEnds.length ? deadEnds : others).slice()
      .sort((a, b) => dist[rk(b.x, b.y)] - dist[rk(a.x, a.y)]);
    const boss = bossPool[0];
    boss.type = 'boss';
    let itemPool = deadEnds.filter(r => r !== boss);
    if (!itemPool.length) itemPool = others.filter(r => r !== boss);
    itemPool[Math.floor(rng() * itemPool.length)].type = 'item';

    for (const r of list) populate(s, r);
    s.rooms = rooms;
    s.cur = { x: 0, y: 0 };
    rooms[rk(0, 0)].visited = true;
  }

  const MENU_OPTIONS = ['Jogar', 'Controles'];

  // opts.menu = true começa na tela de menu em vez de direto no jogo
  function createState(seed, opts) {
    if (seed === undefined) seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const menu = !!(opts && opts.menu);
    const s = {
      seed, rng: makeRng(seed), floor: 1, rooms: {}, cur: { x: 0, y: 0 }, usedBosses: [],
      player: makePlayer(), tears: [], bullets: [], lasers: [], particles: [],
      keys: {}, lastArrow: null, status: menu ? 'menu' : 'playing', paused: false,
      menuIndex: 0, showHelp: false, codeBuf: '', cheatNotice: 0, godMode: false,
      time: 0, grace: 0, shake: 0, kills: 0, msg: menu ? null : { title: 'Andar 1', sub: BIOMES[0].name, t: 2.5 },
    };
    generateFloor(s);
    return s;
  }

  function restart(s, toMenu) {
    const fresh = createState(undefined, { menu: toMenu });
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, fresh);
  }

  function startGame(s) {
    s.status = 'playing';
    s.keys = {};
    s.lastArrow = null;
    s.msg = { title: 'Andar 1', sub: BIOMES[0].name, t: 2.5 };
  }

  // Código secreto: digitar 1234 no menu deixa o bloco indestrutível
  const SECRET_CODE = '1234';
  const CHEAT_NOTICE_TIME = 3;

  function menuKey(s, code) {
    if (s.cheatNotice > 0) return; // aviso na tela: espera os 3 segundos
    const digit = /^(Digit|Numpad)([0-9])$/.exec(code);
    if (digit) {
      s.codeBuf = (s.codeBuf + digit[2]).slice(-SECRET_CODE.length);
      if (s.codeBuf === SECRET_CODE) {
        s.godMode = true;
        s.cheatNotice = CHEAT_NOTICE_TIME;
        s.showHelp = false;
      }
      return;
    }
    if (s.showHelp) {
      if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space' || code === 'Escape' || code === 'Backspace') s.showHelp = false;
      return;
    }
    const n = MENU_OPTIONS.length;
    if (code === 'ArrowUp' || code === 'KeyW') s.menuIndex = (s.menuIndex + n - 1) % n;
    else if (code === 'ArrowDown' || code === 'KeyS') s.menuIndex = (s.menuIndex + 1) % n;
    else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
      if (s.menuIndex === 0) startGame(s); else s.showHelp = true;
    }
  }

  // ---------- Movimento e colisão ----------
  function clampX(s, e, isPlayer) {
    const room = curRoom(s), h = e.size / 2;
    const open = isPlayer && room.cleared;
    const lim = DOOR / 2 - h;
    const inDoorY = Math.abs(e.y - H / 2) <= lim + 0.001;
    if (e.x - h < IX0 && !(open && room.doors.left && inDoorY)) e.x = IX0 + h;
    if (e.x + h > IX1 && !(open && room.doors.right && inDoorY)) e.x = IX1 - h;
    if (e.y - h < IY0 || e.y + h > IY1) e.x = clamp(e.x, W / 2 - lim, W / 2 + lim);
  }

  function clampY(s, e, isPlayer) {
    const room = curRoom(s), h = e.size / 2;
    const open = isPlayer && room.cleared;
    const lim = DOOR / 2 - h;
    const inDoorX = Math.abs(e.x - W / 2) <= lim + 0.001;
    if (e.y - h < IY0 && !(open && room.doors.up && inDoorX)) e.y = IY0 + h;
    if (e.y + h > IY1 && !(open && room.doors.down && inDoorX)) e.y = IY1 - h;
    if (e.x - h < IX0 || e.x + h > IX1) e.y = clamp(e.y, H / 2 - lim, H / 2 + lim);
  }

  function moveEntity(s, e, dx, dy, isPlayer, ignoreRocks) {
    const room = curRoom(s), h = e.size / 2;
    e.x += dx;
    let r = ignoreRocks ? null : hitsRock(room, e.x, e.y, h);
    if (r && dx !== 0) e.x = dx > 0 ? r.x - h : r.x + r.w + h;
    clampX(s, e, isPlayer);
    e.y += dy;
    r = ignoreRocks ? null : hitsRock(room, e.x, e.y, h);
    if (r && dy !== 0) e.y = dy > 0 ? r.y - h : r.y + r.h + h;
    clampY(s, e, isPlayer);
  }

  function updatePlayer(s, dt) {
    const p = s.player, k = s.keys;
    let mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    let my = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0);
    if (mx && my) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
    const a = Math.min(1, dt * 12);
    p.vx += (mx * p.speed - p.vx) * a;
    p.vy += (my * p.speed - p.vy) * a;
    moveEntity(s, p, p.vx * dt, p.vy * dt, true);
  }

  function enterRoom(s, dir) {
    const cur = curRoom(s), d = DIRS[dir];
    const next = s.rooms[rk(cur.x + d.dx, cur.y + d.dy)];
    if (!next) return false;
    s.cur = { x: next.x, y: next.y };
    const p = s.player, h = p.size / 2, m = 12;
    if (dir === 'left') { p.x = IX1 - h - m; p.y = H / 2; }
    if (dir === 'right') { p.x = IX0 + h + m; p.y = H / 2; }
    if (dir === 'up') { p.y = IY1 - h - m; p.x = W / 2; }
    if (dir === 'down') { p.y = IY0 + h + m; p.x = W / 2; }
    s.tears = []; s.bullets = []; s.lasers = [];
    if (p.shield) p.shieldUp = true; // Manto de Vidro recarrega a cada sala
    if (s.buddy) { s.buddy.x = p.x; s.buddy.y = p.y; }
    if (!next.visited) {
      next.visited = true;
      next.enemies = next.spawns.map(sp => makeEnemy(s, sp));
      if (next.enemies.length === 0) next.cleared = true;
      if (next.type === 'boss') {
        const def = BOSSES[next.bossKind];
        s.msg = { title: def.name.toUpperCase(), sub: def.sub, t: 2.2 };
      }
    }
    s.grace = next.type === 'boss' && !next.cleared ? 1.0 : 0.6;
    return true;
  }

  function checkTransition(s) {
    const p = s.player, h = p.size / 2;
    if (p.x < IX0 - h) return enterRoom(s, 'left');
    if (p.x > IX1 + h) return enterRoom(s, 'right');
    if (p.y < IY0 - h) return enterRoom(s, 'up');
    if (p.y > IY1 + h) return enterRoom(s, 'down');
    return false;
  }

  // ---------- Tiros ----------
  function shootDir(s) {
    if (s.lastArrow && s.keys[s.lastArrow]) return SHOOT_KEYS[s.lastArrow];
    for (const c in SHOOT_KEYS) if (s.keys[c]) return SHOOT_KEYS[c];
    return null;
  }

  function updateShooting(s, dt) {
    const p = s.player;
    p.cd -= dt;
    const dir = shootDir(s);
    if (dir) p.face = dir;
    if (!dir || p.cd > 0) return;
    p.cd = p.fireDelay;
    const d = DIRS[dir], h = p.size / 2;
    const angles = p.quad ? [-0.3, -0.1, 0.1, 0.3] : p.triple ? [-0.2, 0, 0.2] : [0];
    for (const a of angles) {
      const c = Math.cos(a), sn = Math.sin(a);
      s.tears.push({
        x: p.x + d.dx * h, y: p.y + d.dy * h,
        vx: (d.dx * c - d.dy * sn) * p.shotSpeed + p.vx * 0.25,
        vy: (d.dx * sn + d.dy * c) * p.shotSpeed + p.vy * 0.25,
        life: p.range, max: p.range, size: p.tearSize, dmg: p.dmg,
        homing: p.homing, spectral: p.spectral, freeze: p.freeze,
        bounces: p.bounce ? 2 : 0, hit: p.pierce ? [] : null,
      });
    }
  }

  function outOfRoom(o) { return o.x < IX0 || o.x > IX1 || o.y < IY0 || o.y > IY1; }

  function steerTear(t, room, dt) {
    let best = null, bd = 320;
    for (const e of room.enemies) {
      if (e.hp <= 0 || e.air) continue;
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return;
    const sp = Math.hypot(t.vx, t.vy) || 1, a = Math.min(1, dt * 5);
    t.vx += ((best.x - t.x) / (bd || 1) * sp - t.vx) * a;
    t.vy += ((best.y - t.y) / (bd || 1) * sp - t.vy) * a;
    const n = Math.hypot(t.vx, t.vy) || 1;
    t.vx *= sp / n; t.vy *= sp / n;
  }

  function updateTears(s, dt) {
    const room = curRoom(s);
    const alive = [];
    for (const t of s.tears) {
      if (t.homing) steerTear(t, room, dt);
      const px = t.x, py = t.y;
      t.x += t.vx * dt; t.y += t.vy * dt; t.life -= dt;
      let dead = t.life <= 0;
      if (!dead && outOfRoom(t)) {
        if (t.bounces > 0) {
          t.bounces--;
          if (t.x < IX0 || t.x > IX1) { t.vx = -t.vx; t.x = clamp(t.x, IX0, IX1); }
          if (t.y < IY0 || t.y > IY1) { t.vy = -t.vy; t.y = clamp(t.y, IY0, IY1); }
        } else dead = true;
      }
      if (!dead && !t.spectral) {
        const r = hitsRock(room, t.x, t.y, t.size / 2);
        if (r) {
          if (t.bounces > 0) {
            t.bounces--;
            const h = t.size / 2;
            if (px + h <= r.x || px - h >= r.x + r.w) t.vx = -t.vx; else t.vy = -t.vy;
            t.x = px; t.y = py;
          } else dead = true;
        }
      }
      if (!dead) {
        for (const e of room.enemies) {
          if (e.hp <= 0 || e.air || !overlap(t, e)) continue;
          if (t.hit && t.hit.includes(e)) continue; // já atravessou este
          if (e.shield) { dead = true; break; }   // escudo: a bolha estoura sem causar dano
          e.hp -= t.dmg; e.flash = 0.1;
          if (t.freeze) e.frozen = 2;
          if (e.type === 'fly' || e.type === 'grunt' || e.type === 'orbiter') { e.kx += t.vx * 0.6; e.ky += t.vy * 0.6; }
          if (t.hit) { t.hit.push(e); continue; }  // Flecha de Cristal: segue em frente
          dead = true;
          break;
        }
      }
      if (dead) burst(s, t.x, t.y, '#bff3ff', 4, 60); else alive.push(t);
    }
    s.tears = alive;
  }

  // Cubinho Orbital e Irmãozinho
  function updateFamiliars(s, dt) {
    const p = s.player, room = curRoom(s);
    if (p.orbital) {
      const a = s.time * 3.2;
      const o = s.orbital = { x: p.x + Math.cos(a) * 52, y: p.y + Math.sin(a) * 52, size: 18 };
      s.bullets = s.bullets.filter(b => {
        if (!overlap(b, o)) return true;
        burst(s, b.x, b.y, '#ffd84a', 4, 60);
        return false;
      });
      for (const e of room.enemies) {
        if (e.hp > 0 && !e.air && !e.shield && overlap(e, o)) { e.hp -= 30 * dt; e.flash = 0.05; }
      }
    } else s.orbital = null;
    if (p.buddy) {
      if (!s.buddy) s.buddy = { x: p.x, y: p.y, cd: 0, size: 18 };
      const b = s.buddy, a = Math.min(1, dt * 6);
      b.x += (p.x - 36 - b.x) * a; b.y += (p.y - 10 - b.y) * a;
      b.cd -= dt;
      const dir = shootDir(s);
      if (dir && b.cd <= 0) {
        b.cd = 0.5;
        const d = DIRS[dir];
        s.tears.push({ x: b.x, y: b.y, vx: d.dx * 400, vy: d.dy * 400, life: 0.8, max: 0.8, size: 10, dmg: 3.5,
          bounces: 0, hit: null, buddy: true });
      }
    } else s.buddy = null;
  }

  function shootAng(s, x, y, ang, speed, extra) {
    const b = { x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, size: 12, life: 6, wait: 0, dmg: 1 };
    if (extra) Object.assign(b, extra);
    s.bullets.push(b);
    return b;
  }

  function ring(s, x, y, n, speed, off, extra) {
    for (let i = 0; i < n; i++) shootAng(s, x, y, (off || 0) + i * TAU / n, speed, extra);
  }

  function updateBullets(s, dt) {
    const room = curRoom(s), p = s.player;
    const alive = [];
    for (const b of s.bullets) {
      if (b.wait > 0) b.wait -= dt;
      else { b.x += b.vx * dt; b.y += b.vy * dt; }
      b.life -= dt;
      if (b.life <= 0 || outOfRoom(b) || hitsRock(room, b.x, b.y, b.size / 2)) {
        burst(s, b.x, b.y, '#ff7aa8', 3, 50);
        continue;
      }
      if (overlap(b, p)) { damagePlayer(s, b.dmg, b.x, b.y); continue; }
      alive.push(b);
    }
    s.bullets = alive;
  }

  function laserEnd(l) {
    const c = Math.cos(l.ang), sn = Math.sin(l.ang);
    let t = 3000;
    if (c > 1e-6) t = Math.min(t, (IX1 - l.ox) / c);
    if (c < -1e-6) t = Math.min(t, (IX0 - l.ox) / c);
    if (sn > 1e-6) t = Math.min(t, (IY1 - l.oy) / sn);
    if (sn < -1e-6) t = Math.min(t, (IY0 - l.oy) / sn);
    return { x: l.ox + c * t, y: l.oy + sn * t };
  }

  function updateLasers(s, dt) {
    const p = s.player;
    s.lasers = s.lasers.filter(l => {
      if (l.owner && l.follow) { l.ox = l.owner.x; l.oy = l.owner.y; }
      if (l.tele > 0) { l.tele -= dt; return true; }
      l.life -= dt;
      l.ang += (l.rot || 0) * dt;
      if (l.life <= 0) return false;
      const e = laserEnd(l);
      const hit = segDist(p.x, p.y, l.ox, l.oy, e.x, e.y);
      if (hit.d < l.width / 2 + p.size * 0.35) damagePlayer(s, 2, hit.x, hit.y);
      return true;
    });
  }

  // ---------- Inimigos ----------
  function damagePlayer(s, amount, fx, fy) {
    const p = s.player;
    if (s.godMode || p.shieldTime > 0 || p.inv > 0 || s.status !== 'playing') return false; // código secreto / escudo P
    if (p.shieldUp) { // Manto de Vidro absorve o golpe
      p.shieldUp = false; p.inv = 1.0;
      burst(s, p.x, p.y, '#ffffff', 16, 160);
      return false;
    }
    p.hp -= amount;
    p.inv = 1.0;
    const dx = p.x - fx, dy = p.y - fy, d = Math.hypot(dx, dy) || 1;
    p.vx = dx / d * 320; p.vy = dy / d * 320;
    s.shake = 0.25;
    burst(s, p.x, p.y, '#7fe3ff', 10, 140);
    if (p.hp <= 0) { p.hp = 0; s.status = 'dead'; }
    return true;
  }

  const aim = (e, p) => Math.atan2(p.y - e.y, p.x - e.x);
  function toIdle(e, t) { e.state = 'idle'; e.timer = t; }

  // IA dos chefões. Cada um tem vários ataques e fica mais agressivo com pouca vida.
  const BOSS_AI = {
    // Inspirado no Monstro: pulinhos, cuspe em leque e o pulão que te persegue pela sombra.
    gelatao(s, e, dt, room, p) {
      const rage = e.hp < e.maxHp / 2;
      e.timer -= dt;
      e.squash *= Math.max(0, 1 - dt * 6);
      if (e.state === 'idle') {
        e.z = 0; e.air = false;
        if (e.timer > 0) return;
        const r = s.rng();
        if (r < 0.4) {
          e.state = 'hop'; e.dur = e.timer = 0.6;
          const a = aim(e, p), d = Math.min(180, Math.hypot(p.x - e.x, p.y - e.y));
          e.sx = e.x; e.sy = e.y; e.tx = e.x + Math.cos(a) * d; e.ty = e.y + Math.sin(a) * d;
        } else if (r < 0.72) { e.state = 'spit'; e.timer = 0.55; }
        else { e.state = 'jumpUp'; e.timer = 0.45; }
      } else if (e.state === 'hop') {
        const f = clamp(1 - e.timer / e.dur, 0, 1);
        e.x = e.sx + (e.tx - e.sx) * f; e.y = e.sy + (e.ty - e.sy) * f;
        clampX(s, e, false); clampY(s, e, false);
        e.z = Math.sin(Math.PI * f) * 50; e.air = e.z > 30;
        if (e.timer <= 0) {
          e.z = 0; e.air = false; e.squash = 1;
          if (rage || s.floor >= 2) ring(s, e.x, e.y, 8, 170, s.rng() * TAU);
          toIdle(e, rage ? 0.35 : 0.7);
        }
      } else if (e.state === 'spit') {
        e.squash = Math.max(e.squash, 1 - e.timer / 0.55);
        if (e.timer <= 0) {
          const a = aim(e, p), n = (rage ? 16 : 11) + 2 * (s.floor - 1);
          for (let i = 0; i < n; i++) {
            shootAng(s, e.x, e.y + 10, a + (s.rng() - 0.5) * 0.95, 140 + s.rng() * 180, { size: 10 + s.rng() * 6 });
          }
          e.squash = 0;
          toIdle(e, rage ? 0.5 : 0.85);
        }
      } else if (e.state === 'jumpUp') {
        const f = 1 - Math.max(0, e.timer) / 0.45;
        e.z = f * f * 700; e.air = e.z > 30;
        if (e.timer <= 0) { e.state = 'air'; e.timer = rage ? 1.0 : 1.3; }
      } else if (e.state === 'air') {
        e.z = 700; e.air = true;
        const d = Math.hypot(p.x - e.x, p.y - e.y) || 1, v = Math.min(d, 300 * dt);
        e.x += (p.x - e.x) / d * v; e.y += (p.y - e.y) / d * v;
        clampX(s, e, false); clampY(s, e, false);
        if (e.timer <= 0) { e.state = 'fall'; e.timer = 0.35; }
      } else if (e.state === 'fall') {
        const f = Math.max(0, e.timer) / 0.35;
        e.z = 700 * f * f; e.air = e.z > 30;
        if (e.timer <= 0) {
          e.z = 0; e.air = false; e.squash = 1; s.shake = 0.4;
          ring(s, e.x, e.y, 14 + 2 * s.floor, 190, s.rng() * TAU);
          if (rage) ring(s, e.x, e.y, 10, 120, s.rng() * TAU);
          toIdle(e, rage ? 0.6 : 1.0);
        }
      }
    },

    // Inspirado no Duke of Flies: quica pela sala, cria bolhas em órbita e as lança em você.
    duque(s, e, dt, room) {
      const rage = e.hp < e.maxHp / 2;
      if (!e.vx && !e.vy) { e.vx = e.speed; e.vy = e.speed * 0.8; }
      const sp = rage ? 1.5 : 1, h = e.size / 2;
      e.x += e.vx * sp * dt; e.y += e.vy * sp * dt;
      if ((e.x - h < IX0 && e.vx < 0) || (e.x + h > IX1 && e.vx > 0)) e.vx *= -1;
      if ((e.y - h < IY0 && e.vy < 0) || (e.y + h > IY1 && e.vy > 0)) e.vy *= -1;
      clampX(s, e, false); clampY(s, e, false);
      e.z = 14 + Math.sin(e.t * 2) * 6;
      e.timer -= dt;
      if (e.timer > 0) return;
      const mine = room.enemies.filter(o => o.type === 'orbiter' && o.parent === e && !o.launched);
      const step = e.cycle++ % 3;
      if (step === 0) {
        const total = room.enemies.filter(o => o.type === 'orbiter').length;
        const n = Math.min(rage ? 5 : 3, 9 - total);
        for (let i = 0; i < n; i++) {
          const o = makeEnemy(s, { type: 'orbiter', x: e.x, y: e.y, summoned: true });
          o.parent = e; o.ang = i * TAU / n + e.t;
          room.enemies.push(o);
        }
        e.state = 'summon';
      } else if (step === 1 && mine.length) {
        mine.forEach(o => { o.launched = true; });
        e.state = 'release';
      } else {
        ring(s, e.x, e.y, rage ? 14 : 10, 170, e.t);
        if (rage) ring(s, e.x, e.y, 14, 110, e.t + 0.22);
        e.state = 'burst';
      }
      e.timer = rage ? 1.3 : 1.9;
    },

    // Chefão de laser: avisa com uma linha fina e depois dispara o raio. Se teleporta e faz espirais.
    prisma(s, e, dt, room, p) {
      const rage = e.hp < e.maxHp / 2;
      e.spin += dt * (rage ? 2.6 : 1.4);
      e.z = 22 + Math.sin(e.t * 3) * 6;
      e.timer -= dt;
      switch (e.state) {
        case 'idle': {
          e.alpha = 1; e.air = false;
          if (e.timer > 0) break;
          const seq = ['laser', 'spiral', 'tele', 'burst', 'laser', 'tele'];
          e.state = seq[e.cycle++ % seq.length];
          if (e.state === 'laser') {
            const n = rage ? 3 : 1, base = aim(e, p);
            for (let i = 0; i < n; i++) {
              s.lasers.push({ ox: e.x, oy: e.y, ang: base + (i - (n - 1) / 2) * 0.5, tele: 0.9, life: 0.8,
                width: 26, rot: rage ? (i - 1) * 0.5 : 0, owner: e });
            }
            e.timer = 1.8;
          } else if (e.state === 'spiral') { e.timer = 2.6; e.emit = 0; }
          else if (e.state === 'tele') { e.timer = 0.4; }
          else { e.timer = 1.1; e.emit = 0; e.shots = 0; }
          break;
        }
        case 'laser':
          if (e.timer <= 0) toIdle(e, rage ? 0.3 : 0.6);
          break;
        case 'spiral':
          e.emit -= dt;
          if (e.emit <= 0) {
            e.emit = rage ? 0.08 : 0.12;
            const arms = rage ? 5 : 4;
            for (let i = 0; i < arms; i++) shootAng(s, e.x, e.y, e.spin + i * TAU / arms, 150);
          }
          if (e.timer <= 0) toIdle(e, 0.6);
          break;
        case 'tele':
          e.alpha = Math.max(0, e.timer / 0.4); e.air = true;
          if (e.timer <= 0) {
            for (let i = 0; i < 30; i++) {
              const x = IX0 + 80 + s.rng() * (IX1 - IX0 - 160), y = IY0 + 80 + s.rng() * (IY1 - IY0 - 160);
              e.x = x; e.y = y;
              if (Math.hypot(x - p.x, y - p.y) > 240) break;
            }
            e.state = 'teleIn'; e.timer = 0.4;
          }
          break;
        case 'teleIn':
          e.alpha = 1 - Math.max(0, e.timer / 0.4); e.air = e.timer > 0.15;
          if (e.timer <= 0) { e.alpha = 1; e.air = false; toIdle(e, 0.3); }
          break;
        case 'burst':
          e.emit -= dt;
          if (e.emit <= 0 && e.shots < 3) {
            e.emit = 0.35; e.shots++;
            const a = aim(e, p), n = rage ? 7 : 5;
            for (let i = 0; i < n; i++) shootAng(s, e.x, e.y, a + (i - (n - 1) / 2) * 0.22, 230);
          }
          if (e.timer <= 0) toIdle(e, 0.5);
          break;
      }
    },

    // Chefão final em 3 fases: investidas, espirais, invocações e cruz de lasers giratória.
    hipercubo(s, e, dt, room, p) {
      const frac = e.hp / e.maxHp;
      const phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
      if (phase > e.phase) {
        e.phase = phase; e.state = 'shift'; e.timer = 1.2; e.shield = true; e.air = false; e.z = 0;
        s.bullets = []; s.lasers = []; s.shake = 0.5;
        s.msg = { title: 'FASE ' + phase, sub: phase === 3 ? 'Fúria total' : 'O cubo se dobra...', t: 1.4 };
      }
      e.spin += dt * (1 + e.phase);
      e.timer -= dt;
      switch (e.state) {
        case 'shift':
          if (e.timer <= 0) { e.shield = false; toIdle(e, 0.3); }
          break;
        case 'idle': {
          e.z = 0;
          if (e.timer > 0) break;
          const seqs = {
            1: ['charge', 'stomp', 'charge', 'spiral'],
            2: ['charge', 'spiral', 'summon', 'charge', 'stomp'],
            3: ['cross', 'charge', 'stomp', 'charge', 'spiral'],
          };
          const seq = seqs[e.phase];
          const next = seq[e.cycle++ % seq.length];
          if (next === 'charge') { e.state = 'chargeWind'; e.timer = e.phase === 3 ? 0.45 : 0.7; e.cang = aim(e, p); }
          else if (next === 'stomp') { e.state = 'stomp'; e.timer = 0.6; }
          else if (next === 'spiral') { e.state = 'spiral'; e.timer = 2.8; e.emit = 0; }
          else if (next === 'summon') {
            e.state = 'summon'; e.timer = 0.6;
            if (room.enemies.filter(o => o.type === 'grunt').length < 3) {
              room.enemies.push(makeEnemy(s, { type: 'grunt', x: clamp(e.x - 80, IX0 + 20, IX1 - 20), y: e.y, summoned: true }));
              room.enemies.push(makeEnemy(s, { type: 'grunt', x: clamp(e.x + 80, IX0 + 20, IX1 - 20), y: e.y, summoned: true }));
            }
          } else { e.state = 'crossMove'; e.timer = 0.6; e.sx = e.x; e.sy = e.y; }
          break;
        }
        case 'chargeWind':
          if (e.timer <= 0) { e.state = 'charging'; e.timer = 1.6; e.emit = 0; }
          break;
        case 'charging': {
          const sp = 520 + 60 * e.phase, ox = e.x, oy = e.y;
          moveEntity(s, e, Math.cos(e.cang) * sp * dt, Math.sin(e.cang) * sp * dt, false);
          e.emit -= dt;
          if (e.emit <= 0) {
            e.emit = 0.07;
            if (e.phase === 1) shootAng(s, e.x, e.y, 0, 0, { life: 1.0 });
            else {
              shootAng(s, e.x, e.y, e.cang + Math.PI / 2, 90, { wait: 0.35 });
              shootAng(s, e.x, e.y, e.cang - Math.PI / 2, 90, { wait: 0.35 });
            }
          }
          if (Math.hypot(e.x - ox, e.y - oy) < sp * dt * 0.5 || e.timer <= 0) {
            ring(s, e.x, e.y, 10 + 4 * e.phase, 200, s.rng() * TAU);
            s.shake = 0.35;
            toIdle(e, e.phase === 3 ? 0.35 : 0.7);
          }
          break;
        }
        case 'stomp': {
          const f = 1 - Math.max(0, e.timer) / 0.6;
          e.z = Math.sin(Math.PI * f) * 60; e.air = e.z > 30;
          if (e.timer <= 0) {
            e.z = 0; e.air = false; s.shake = 0.3;
            ring(s, e.x, e.y, 18, 180, e.spin);
            if (e.phase >= 2) ring(s, e.x, e.y, 18, 120, e.spin + 0.17);
            if (e.phase === 3) ring(s, e.x, e.y, 12, 250, e.spin + 0.3);
            toIdle(e, 0.6);
          }
          break;
        }
        case 'spiral':
          e.emit -= dt;
          if (e.emit <= 0) {
            e.emit = 0.09;
            const arms = e.phase + 1;
            for (let i = 0; i < arms; i++) {
              shootAng(s, e.x, e.y, e.spin + i * TAU / arms, 160);
              if (e.phase === 3) shootAng(s, e.x, e.y, -e.spin + i * TAU / arms, 130);
            }
          }
          if (e.timer <= 0) toIdle(e, 0.5);
          break;
        case 'summon':
          if (e.timer <= 0) toIdle(e, 0.4);
          break;
        case 'crossMove': {
          const f = 1 - Math.max(0, e.timer) / 0.6;
          e.x = e.sx + (W / 2 - e.sx) * f; e.y = e.sy + (H / 2 - e.sy) * f;
          if (e.timer <= 0) {
            const a0 = s.rng() * Math.PI;
            for (let i = 0; i < 4; i++) {
              s.lasers.push({ ox: e.x, oy: e.y, ang: a0 + i * Math.PI / 2, tele: 1.0, life: 3.6,
                width: 24, rot: 0.55, owner: e, follow: true });
            }
            e.state = 'cross'; e.timer = 4.6; e.emit = 1.2;
          }
          break;
        }
        case 'cross':
          e.emit -= dt;
          if (e.emit <= 0) { e.emit = 1.1; ring(s, e.x, e.y, 12, 150, e.spin); }
          if (e.timer <= 0) toIdle(e, 0.5);
          break;
      }
    },
  };

  function updateEnemies(s, dt) {
    const room = curRoom(s), p = s.player;
    for (const e of room.enemies.slice()) {
      e.flash = Math.max(0, e.flash - dt);
      e.t += dt;
      if (s.grace > 0 || e.hp <= 0) continue;
      const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist, uy = dy / dist;
      const edt = e.frozen > 0 ? dt * 0.4 : dt; // Bolha Gelada: inimigo lento
      if (e.frozen > 0) e.frozen -= dt;
      if (e.type === 'boss') {
        BOSS_AI[e.kind](s, e, edt, room, p);
      } else if (e.type === 'fly') {
        const wob = Math.sin(e.t * 6) * 45;
        moveEntity(s, e, (ux * e.speed - uy * wob + e.kx) * edt, (uy * e.speed + ux * wob + e.ky) * edt, false, true);
      } else if (e.type === 'orbiter') {
        const par = e.parent;
        if (!e.launched && (!par || par.hp <= 0 || !room.enemies.includes(par))) e.launched = true;
        if (!e.launched) {
          e.ang += 2.4 * edt;
          const r = par.size / 2 + 34;
          e.x = par.x + Math.cos(e.ang) * r; e.y = par.y + Math.sin(e.ang) * r;
          clampX(s, e, false); clampY(s, e, false);
        } else {
          const a = Math.min(1, edt * 2.5);
          e.vx += (ux * e.speed - e.vx) * a; e.vy += (uy * e.speed - e.vy) * a;
          moveEntity(s, e, (e.vx + e.kx) * edt, (e.vy + e.ky) * edt, false, true);
        }
      } else if (e.type === 'grunt') {
        moveEntity(s, e, (ux * e.speed + e.kx) * edt, (uy * e.speed + e.ky) * edt, false);
      } else if (e.type === 'turret') {
        e.cd -= edt;
        if (e.cd <= 0) { e.cd = 1.8 - 0.2 * (s.floor - 1); shootAng(s, e.x, e.y, Math.atan2(uy, ux), 210); }
      }
      const decay = Math.max(0, 1 - dt * 8);
      e.kx *= decay; e.ky *= decay;
      if (e.hp > 0 && !e.air && overlap(e, p)) damagePlayer(s, e.type === 'boss' ? 2 : 1, e.x, e.y);
    }
  }

  function cleanupEnemies(s) {
    const room = curRoom(s);
    const alive = [];
    let bossDied = false;
    for (const e of room.enemies) {
      if (e.hp > 0) { alive.push(e); continue; }
      s.kills++;
      const p = s.player;
      if (p.vampire && ++p.vampKills % 8 === 0 && p.hp < p.maxHp) {
        p.hp++;
        burst(s, p.x, p.y, '#ff4f6d', 10, 100);
      }
      burst(s, e.x, e.y, enemyColor(e), e.type === 'boss' ? 50 : 12, e.type === 'boss' ? 300 : 150);
      if (e.type === 'boss') bossDied = true;
      else if (s.rng() < 0.1) room.pickups.push({ type: 'heart', x: e.x, y: e.y, size: 20 });
    }
    room.enemies = alive;
    if (bossDied) {
      // derrotar o chefão destrói os lacaios e limpa os tiros
      for (const e of room.enemies) burst(s, e.x, e.y, enemyColor(e), 10, 120);
      room.enemies = [];
      s.bullets = []; s.lasers = [];
      s.shake = 0.6;
    }
  }

  function checkRoomClear(s) {
    const room = curRoom(s);
    if (room.cleared || room.enemies.length) return;
    room.cleared = true;
    if (room.type === 'boss') {
      room.pickups.push({ type: 'heart', x: W / 2 - 150, y: H / 2, size: 20 });
      room.item = { x: W / 2 + 150, y: H / 2, size: 30, id: pickItemId(s), taken: false };
      if (s.floor >= MAX_FLOOR) {
        s.status = 'won';
      } else {
        room.trapdoor = { x: W / 2, y: H / 2, size: 54, armed: false };
        s.msg = { title: 'Chefão derrotado!', sub: 'Pegue o prêmio e pule no portal', t: 3 };
      }
    } else if (s.rng() < 0.25) {
      room.pickups.push({ type: 'heart', x: W / 2, y: H / 2, size: 20 });
    }
  }

  function nextFloor(s) {
    s.floor++;
    generateFloor(s);
    const p = s.player;
    p.x = W / 2; p.y = H / 2; p.vx = 0; p.vy = 0;
    s.tears = []; s.bullets = []; s.lasers = [];
    s.msg = { title: 'Andar ' + s.floor, sub: biome(s).name, t: 2.5 };
  }

  function updatePickups(s) {
    const room = curRoom(s), p = s.player;
    room.pickups = room.pickups.filter(pk => {
      if (pk.type === 'heart' && overlap(pk, p) && p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + 2);
        burst(s, pk.x, pk.y, '#ff6f9f', 8, 90);
        return false;
      }
      return true;
    });
    const it = room.item;
    if (it && !it.taken && overlap(it, p)) {
      const def = ITEMS.find(i => i.id === it.id);
      def.apply(p);
      p.items.push(def.id);
      it.taken = true;
      s.msg = { title: def.name, sub: def.desc, t: 3 };
      burst(s, it.x, it.y, def.color, 24, 170);
    }
    const td = room.trapdoor;
    if (td) {
      if (!overlap(td, p)) td.armed = true;
      else if (td.armed && Math.hypot(td.x - p.x, td.y - p.y) < 20) nextFloor(s);
    }
  }

  // ---------- Partículas ----------
  function burst(s, x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.3 + Math.random() * 0.7);
      s.particles.push({ x, y, z: 14, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 60 + Math.random() * 120,
        life: 0.5, max: 0.5, color, size: 3 + Math.random() * 4 });
    }
  }

  function updateParticles(s, dt) {
    for (const q of s.particles) {
      q.x += q.vx * dt; q.y += q.vy * dt; q.z = Math.max(0, q.z + q.vz * dt);
      q.vz -= 500 * dt; q.vx *= 0.92; q.vy *= 0.92; q.life -= dt;
    }
    s.particles = s.particles.filter(q => q.life > 0);
  }

  // ---------- Loop principal ----------
  function update(s, dt) {
    dt = Math.min(dt, 0.05);
    s.time += dt;
    updateParticles(s, dt);
    if (s.msg) { s.msg.t -= dt; if (s.msg.t <= 0) s.msg = null; }
    if (s.status === 'menu' && s.cheatNotice > 0) {
      s.cheatNotice -= dt;
      if (s.cheatNotice <= 0) { s.cheatNotice = 0; startGame(s); }
      return;
    }
    if (s.status !== 'playing' || s.paused) return;
    s.grace = Math.max(0, s.grace - dt);
    s.shake = Math.max(0, s.shake - dt);
    s.player.inv = Math.max(0, s.player.inv - dt);
    s.player.shieldTime = Math.max(0, s.player.shieldTime - dt);
    s.player.shieldCd = Math.max(0, s.player.shieldCd - dt);
    updatePlayer(s, dt);
    if (checkTransition(s)) return;
    updateShooting(s, dt);
    updateTears(s, dt);
    updateEnemies(s, dt);
    updateBullets(s, dt);
    updateLasers(s, dt);
    updateFamiliars(s, dt);
    cleanupEnemies(s);
    checkRoomClear(s);
    updatePickups(s);
  }

  // ---------- Entrada ----------
  // Escudo da tecla P: 10 s sem tomar dano; recarrega 20 s depois de ativado
  function activateShield(s) {
    const p = s.player;
    if (p.shieldTime > 0 || p.shieldCd > 0) return false;
    p.shieldTime = SHIELD_TIME;
    p.shieldCd = SHIELD_COOLDOWN;
    burst(s, p.x, p.y, '#bff3ff', 24, 180);
    return true;
  }

  // A música fica mais pesada durante a luta contra um chefão
  function musicIntensity(s) {
    if (s.status !== 'playing') return 0;
    return curRoom(s).enemies.some(e => e.type === 'boss' && e.hp > 0) ? 1 : 0;
  }

  function setKey(s, code, down) {
    if (s.status === 'menu') { if (down) menuKey(s, code); return; } // no menu as teclas não controlam o bloco
    if (down && code === 'KeyR' && s.status !== 'playing') { restart(s); return; }
    if (down && code === 'Escape' && s.status !== 'playing') { restart(s, true); return; }
    if (down && code === 'Escape' && s.status === 'playing') s.paused = !s.paused;
    if (down && code === 'KeyP' && s.status === 'playing' && !s.paused) activateShield(s);
    s.keys[code] = down;
    if (down && SHOOT_KEYS[code]) s.lastArrow = code;
  }

  function bindInput(s, target) {
    const block = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
    target.addEventListener('keydown', e => {
      if (block.has(e.code) && e.preventDefault) e.preventDefault();
      if (e.repeat) return;
      setKey(s, e.code, true);
    });
    target.addEventListener('keyup', e => setKey(s, e.code, false));
    target.addEventListener('blur', () => { s.keys = {}; });
  }

  // =====================================================================
  // ---------- Texturas procedurais (Frutiger Aero) ----------
  // =====================================================================
  let TEX = null;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  const rgb = (c, a) => a === undefined
    ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'
    : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    return rgb([r, g, b]);
  }

  function softBlob(g, x, y, r, color) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function texSky() {
    const c = makeCanvas(W, SCREEN_H), g = c.getContext('2d'), rng = makeRng(7);
    const gr = g.createLinearGradient(0, 0, 0, SCREEN_H);
    gr.addColorStop(0, '#1b7fd4'); gr.addColorStop(0.45, '#62c3f3');
    gr.addColorStop(0.8, '#c4efff'); gr.addColorStop(1, '#e9fcff');
    g.fillStyle = gr; g.fillRect(0, 0, W, SCREEN_H);
    g.save(); g.translate(110, 30);
    for (let i = 0; i < 10; i++) {
      g.rotate(0.3 + rng() * 0.2);
      g.fillStyle = 'rgba(255,255,255,0.07)';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(1100, -50); g.lineTo(1100, 50); g.closePath(); g.fill();
    }
    g.restore();
    softBlob(g, 110, 30, 260, 'rgba(255,255,235,0.85)');
    softBlob(g, 110, 30, 60, 'rgba(255,255,255,1)');
    for (let i = 0; i < 16; i++) {
      const cx = rng() * W, cy = 60 + rng() * SCREEN_H * 0.85, r = 26 + rng() * 50;
      for (let j = 0; j < 5; j++) {
        softBlob(g, cx + (j - 2) * r * 0.6, cy + Math.sin(j * 1.7) * r * 0.18, r * (0.6 + rng() * 0.5), 'rgba(255,255,255,0.75)');
      }
    }
    // relva brilhante na parte de baixo
    const gg = g.createLinearGradient(0, SCREEN_H - 50, 0, SCREEN_H);
    gg.addColorStop(0, 'rgba(120,220,90,0)'); gg.addColorStop(1, 'rgba(90,200,70,0.7)');
    g.fillStyle = gg; g.fillRect(0, SCREEN_H - 50, W, 50);
    return c;
  }

  function texFloor(b, seed) {
    const fw = IX1 - IX0, fh = IY1 - IY0;
    const c = makeCanvas(fw, fh), g = c.getContext('2d'), rng = makeRng(seed);
    for (let cx = 0; cx < fw / TILE; cx++) {
      for (let cy = 0; cy < fh / TILE; cy++) {
        const x = cx * TILE, y = cy * TILE, v = 0.93 + rng() * 0.12, alt = (cx + cy) % 2 ? 0.95 : 1;
        const A = b.tileA.map(q => Math.min(255, q * v)), B = b.tileB.map(q => Math.min(255, q * v * alt));
        const gr = g.createLinearGradient(x, y, x + TILE, y + TILE);
        gr.addColorStop(0, rgb(A)); gr.addColorStop(1, rgb(B));
        g.fillStyle = gr; g.fillRect(x, y, TILE, TILE);
        const sh = g.createLinearGradient(x, y, x, y + TILE * 0.55);
        sh.addColorStop(0, 'rgba(255,255,255,0.5)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = sh; g.fillRect(x + 2, y + 2, TILE - 4, TILE * 0.5);
        g.strokeStyle = b.grout; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      }
    }
    if (b.id === 'lagoa') {
      for (let i = 0; i < 80; i++) {
        g.strokeStyle = 'rgba(255,255,255,' + (0.15 + rng() * 0.2) + ')';
        g.lineWidth = 1 + rng() * 2;
        let x = rng() * fw, y = rng() * fh;
        g.beginPath(); g.moveTo(x, y);
        for (let j = 0; j < 3; j++) {
          const nx = x + (rng() - 0.5) * 70, ny = y + (rng() - 0.5) * 40;
          g.quadraticCurveTo((x + nx) / 2 + (rng() - 0.5) * 30, (y + ny) / 2 + (rng() - 0.5) * 30, nx, ny);
          x = nx; y = ny;
        }
        g.stroke();
      }
    } else if (b.id === 'prado') {
      for (let i = 0; i < 320; i++) {
        const x = rng() * fw, y = rng() * fh;
        g.strokeStyle = rng() < 0.55 ? 'rgba(40,140,30,0.45)' : 'rgba(255,255,255,0.4)';
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * 6, y - 6 - rng() * 8); g.stroke();
      }
      const petals = ['#ffffff', '#fff27a', '#ffb3d9'];
      for (let i = 0; i < 45; i++) {
        const x = rng() * fw, y = rng() * fh;
        g.fillStyle = petals[i % 3];
        for (let j = 0; j < 5; j++) {
          g.beginPath(); g.arc(x + Math.cos(j * 1.26) * 3, y + Math.sin(j * 1.26) * 3, 2.4, 0, TAU); g.fill();
        }
        g.fillStyle = '#ffb52e'; g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill();
      }
    } else {
      for (let i = 0; i < 14; i++) softBlob(g, rng() * fw, rng() * fh, 40 + rng() * 60, 'rgba(255,255,255,0.45)');
      g.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 45; i++) {
        const x = rng() * fw, y = rng() * fh, r = 2 + rng() * 3;
        g.beginPath();
        g.moveTo(x, y - r * 2); g.lineTo(x + r * 0.4, y - r * 0.4); g.lineTo(x + r * 2, y);
        g.lineTo(x + r * 0.4, y + r * 0.4); g.lineTo(x, y + r * 2); g.lineTo(x - r * 0.4, y + r * 0.4);
        g.lineTo(x - r * 2, y); g.lineTo(x - r * 0.4, y - r * 0.4); g.closePath(); g.fill();
      }
    }
    return c;
  }

  function texWall(b) {
    const w = IX1 - IX0, c = makeCanvas(w, WALL_H), g = c.getContext('2d'), rng = makeRng(99);
    const gr = g.createLinearGradient(0, 0, 0, WALL_H);
    gr.addColorStop(0, b.wallA); gr.addColorStop(1, b.wallB);
    g.fillStyle = gr; g.fillRect(0, 0, w, WALL_H);
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2;
    for (let x = 0; x < w; x += 80) g.strokeRect(x + 3, 6, 74, WALL_H - 10);
    const sh = g.createLinearGradient(0, 0, 0, WALL_H * 0.5);
    sh.addColorStop(0, 'rgba(255,255,255,0.75)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh; g.fillRect(0, 0, w, WALL_H * 0.5);
    for (let i = 0; i < 40; i++) {
      const x = rng() * w, y = 8 + rng() * (WALL_H - 14), r = 1.2 + rng() * 2.6;
      g.fillStyle = 'rgba(30,90,140,0.25)'; g.beginPath(); g.arc(x + 0.8, y + 1, r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.fillStyle = b.wallTop; g.fillRect(0, 0, w, 4);
    return c;
  }

  function texBubble(size) {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = size / 2;
    const gr = g.createRadialGradient(r, r, r * 0.2, r, r, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.08)');
    gr.addColorStop(0.75, 'rgba(170,230,255,0.28)');
    gr.addColorStop(1, 'rgba(110,195,255,0.75)');
    g.fillStyle = gr; g.beginPath(); g.arc(r, r, r - 1, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = Math.max(1, size * 0.03); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.beginPath(); g.ellipse(r * 0.65, r * 0.55, r * 0.3, r * 0.16, -0.6, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.arc(r * 1.45, r * 1.4, r * 0.08, 0, TAU); g.fill();
    return c;
  }

  function texOrb(size, light, mid, dark) {
    const c = makeCanvas(size, size), g = c.getContext('2d'), r = size / 2;
    const gr = g.createRadialGradient(r * 0.7, r * 0.6, r * 0.05, r, r, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, light);
    gr.addColorStop(0.7, mid); gr.addColorStop(1, dark);
    g.fillStyle = gr; g.beginPath(); g.arc(r, r, r - 0.5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.ellipse(r, r * 0.45, r * 0.55, r * 0.26, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = Math.max(1, size * 0.05);
    g.beginPath(); g.arc(r, r, r * 0.8, 0.4, Math.PI - 0.4); g.stroke();
    return c;
  }

  function heartPath(g, x, y, size) {
    const s = size / 2;
    g.beginPath();
    g.moveTo(x, y + s * 0.9);
    g.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.45);
    g.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
    g.closePath();
  }

  function texHeart(size, light, dark) {
    const c = makeCanvas(size, size), g = c.getContext('2d');
    heartPath(g, size / 2, size / 2 + 1, size * 0.9);
    const gr = g.createLinearGradient(0, 0, 0, size);
    gr.addColorStop(0, light); gr.addColorStop(1, dark);
    g.fillStyle = gr; g.fill();
    g.save(); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.ellipse(size * 0.36, size * 0.3, size * 0.2, size * 0.12, -0.5, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.5;
    heartPath(g, size / 2, size / 2 + 1, size * 0.9); g.stroke();
    return c;
  }

  function buildTextures() {
    if (TEX) return TEX;
    const t = {
      sky: texSky(),
      bubble: texBubble(64),
      tear: texOrb(32, '#c9f6ff', '#4fd0ff', '#0a78c8'),
      bullet: texOrb(32, '#ffd0e0', '#ff4f8b', '#a3004a'),
      fly: texOrb(32, '#fff3c4', '#ffb32b', '#c06a00'),
      orbiter: texOrb(32, '#f3dcff', '#b678ff', '#6a2fc0'),
      turret: texOrb(32, '#dcfbff', '#29c6d6', '#0a6f8a'),
      duke: texOrb(64, '#f1e4ff', '#a78bfa', '#5b3fb5'),
      heart: texHeart(32, '#ff9fbf', '#e8004f'),
      heartEmpty: texHeart(32, 'rgba(255,255,255,0.55)', 'rgba(110,150,190,0.55)'),
    };
    BIOMES.forEach((b, i) => {
      t['floor_' + b.id] = texFloor(b, 100 + i);
      t['wall_' + b.id] = texWall(b);
    });
    TEX = t;
    return t;
  }

  // =====================================================================
  // ---------- Desenho 2.5D ----------
  // =====================================================================
  function poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  const lerpPt = (a, b, f) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });

  function vGrad(ctx, y0, y1, c0, c1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    return g;
  }

  // Cubo brilhante com topo, frente e a lateral voltada para o centro da tela.
  function drawCube(ctx, x, y, z, sz, ht, col, alpha, wide) {
    const hx = (wide || sz) / 2, hy = sz / 2;
    const x0 = x - hx, x1 = x + hx, y0 = y - hy, y1 = y + hy, zt = z + ht;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    const sx = x < W / 2 ? x1 : x0;
    poly(ctx, [proj(sx, y0, z), proj(sx, y1, z), proj(sx, y1, zt), proj(sx, y0, zt)], col.side);
    const f = [proj(x0, y1, z), proj(x1, y1, z), proj(x1, y1, zt), proj(x0, y1, zt)];
    poly(ctx, f, vGrad(ctx, f[3].y, f[0].y, col.front, col.side));
    const mid = (f[3].y + f[0].y) / 2;
    poly(ctx, [f[3], f[2], { x: f[2].x, y: mid }, { x: f[3].x, y: mid }], 'rgba(255,255,255,0.3)');
    const top = [proj(x0, y0, zt), proj(x1, y0, zt), proj(x1, y1, zt), proj(x0, y1, zt)];
    const tg = ctx.createLinearGradient(top[0].x, top[0].y, top[2].x, top[2].y);
    tg.addColorStop(0, col.top); tg.addColorStop(1, col.front);
    poly(ctx, top, tg);
    poly(ctx, [top[0], lerpPt(top[0], top[1], 0.55), lerpPt(top[3], top[2], 0.2), top[3]], 'rgba(255,255,255,0.35)');
    poly(ctx, top, null, 'rgba(255,255,255,0.85)', 1.2);
    ctx.beginPath(); ctx.moveTo(f[3].x, f[3].y); ctx.lineTo(f[2].x, f[2].y);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    return { front: f, top };
  }

  function drawSprite(ctx, img, x, y, z, r, alpha) {
    const p = proj(x, y, z + r), k = sc(y);
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(img, p.x - r * k, p.y - r * k, r * 2 * k, r * 2 * k);
    ctx.globalAlpha = 1;
    return { x: p.x, y: p.y, r: r * k };
  }

  function drawShadow(ctx, x, y, r, alpha) {
    const p = proj(x, y, 0), k = sc(y);
    ctx.fillStyle = 'rgba(10,60,110,' + (alpha === undefined ? 0.25 : alpha) + ')';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r * k, r * k * YSCALE * 0.75, 0, 0, TAU); ctx.fill();
  }

  function faceEyes(ctx, f, dir, scale, pupil) {
    const cx = (f[0].x + f[1].x) / 2, cy = (f[0].y + f[3].y) / 2 - 1;
    const fw = f[1].x - f[0].x, er = fw * 0.11 * (scale || 1);
    for (const side of [-1, 1]) {
      const ex = cx + side * fw * 0.2;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(ex, cy, er, er * 1.25, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = pupil || '#0b3556';
      ctx.beginPath(); ctx.arc(ex + dir.x * er * 0.45, cy + dir.y * er * 0.5, er * 0.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex + dir.x * er * 0.45 - er * 0.2, cy + dir.y * er * 0.5 - er * 0.25, er * 0.2, 0, TAU); ctx.fill();
    }
  }

  function drawFloor(ctx, s) {
    const T = buildTextures(), tex = T['floor_' + biome(s).id], step = 4;
    for (let y = IY0; y < IY1; y += step) {
      const k = sc(y + step / 2), a = proj(IX0, y, 0), b = proj(IX0, y + step, 0);
      ctx.drawImage(tex, 0, y - IY0, tex.width, step, W / 2 + (IX0 - W / 2) * k, a.y, (IX1 - IX0) * k, b.y - a.y + 0.8);
    }
  }

  function doorColor(s, room, dir) {
    const n = s.rooms[rk(room.x + DIRS[dir].dx, room.y + DIRS[dir].dy)];
    return n.type === 'boss' ? '#ff4f6d' : n.type === 'item' ? '#ffcf3a' : '#ffffff';
  }

  function drawDoorQuad(ctx, q, color, open, t) {
    poly(ctx, q, null, color, 7);
    poly(ctx, q, null, 'rgba(255,255,255,0.9)', 2);
    if (open) {
      poly(ctx, q, vGrad(ctx, q[3].y, q[0].y, '#0d4f7c', '#3fc4ff'));
      ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.1;
      poly(ctx, [lerpPt(q[0], q[1], 0.3), lerpPt(q[0], q[1], 0.7), lerpPt(q[3], q[2], 0.7), lerpPt(q[3], q[2], 0.3)], '#ffffff');
      ctx.globalAlpha = 1;
    } else {
      poly(ctx, q, vGrad(ctx, q[3].y, q[0].y, 'rgba(240,252,255,0.95)', 'rgba(150,215,245,0.95)'));
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        const a = lerpPt(q[0], q[1], i / 4), b = lerpPt(q[3], q[2], i / 4);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  }

  function drawWalls(ctx, s, room) {
    const T = buildTextures(), b = biome(s), wtex = T['wall_' + b.id];
    const topFill = (pts) => {
      poly(ctx, pts, vGrad(ctx, pts[0].y, pts[2].y, b.wallTop, b.wallTopB));
      poly(ctx, pts, null, 'rgba(255,255,255,0.8)', 1);
    };
    // tampo da parede de trás
    topFill([proj(0, 0, WALL_H), proj(W, 0, WALL_H), proj(W, IY0, WALL_H), proj(0, IY0, WALL_H)]);
    // face da parede de trás (retângulo na tela)
    const bl = proj(IX0, IY0, WALL_H), br = proj(IX1, IY0, 0);
    ctx.drawImage(wtex, bl.x, bl.y, br.x - bl.x, br.y - bl.y);
    // faces laterais em fatias (perspectiva)
    const step = 3, len = IY1 - IY0;
    for (const wx of [IX0, IX1]) {
      for (let y = IY0; y < IY1; y += step) {
        const b0 = proj(wx, y, 0), t0 = proj(wx, y, WALL_H), b1 = proj(wx, y + step, 0);
        const sx = ((y - IY0) / len) * wtex.width, sw = (step / len) * wtex.width;
        ctx.drawImage(wtex, sx, 0, Math.max(1, sw), WALL_H, Math.min(b0.x, b1.x) - 0.4, t0.y, Math.abs(b1.x - b0.x) + 0.8, b0.y - t0.y);
      }
      // sombreado: a lateral recebe menos luz
      poly(ctx, [proj(wx, IY0, 0), proj(wx, IY1, 0), proj(wx, IY1, WALL_H), proj(wx, IY0, WALL_H)], 'rgba(20,80,140,0.12)');
    }
    topFill([proj(0, IY0, WALL_H), proj(IX0, IY0, WALL_H), proj(IX0, IY1, WALL_H), proj(0, IY1, WALL_H)]);
    topFill([proj(IX1, IY0, WALL_H), proj(W, IY0, WALL_H), proj(W, IY1, WALL_H), proj(IX1, IY1, WALL_H)]);
    // portas de trás e laterais
    const d0 = W / 2 - DOOR / 2, d1 = W / 2 + DOOR / 2, e0 = H / 2 - DOOR / 2, e1 = H / 2 + DOOR / 2;
    if (room.doors.up) drawDoorQuad(ctx, [proj(d0, IY0, 0), proj(d1, IY0, 0), proj(d1, IY0, DOOR_H), proj(d0, IY0, DOOR_H)], doorColor(s, room, 'up'), room.cleared, s.time);
    if (room.doors.left) drawDoorQuad(ctx, [proj(IX0, e1, 0), proj(IX0, e0, 0), proj(IX0, e0, DOOR_H), proj(IX0, e1, DOOR_H)], doorColor(s, room, 'left'), room.cleared, s.time);
    if (room.doors.right) drawDoorQuad(ctx, [proj(IX1, e0, 0), proj(IX1, e1, 0), proj(IX1, e1, DOOR_H), proj(IX1, e0, DOOR_H)], doorColor(s, room, 'right'), room.cleared, s.time);
  }

  // Parede da frente: baixa e de vidro, desenhada por cima de tudo.
  function drawFrontWall(ctx, s, room) {
    const b = biome(s);
    // pontas das paredes laterais
    for (const [xa, xb] of [[0, IX0], [IX1, W]]) {
      const f = [proj(xa, IY1, 0), proj(xb, IY1, 0), proj(xb, IY1, WALL_H), proj(xa, IY1, WALL_H)];
      poly(ctx, f, vGrad(ctx, f[3].y, f[0].y, b.wallA, b.wallB));
      poly(ctx, f, null, 'rgba(255,255,255,0.8)', 1);
    }
    const d0 = W / 2 - DOOR / 2, d1 = W / 2 + DOOR / 2;
    const segs = room.doors.down ? [[0, d0], [d1, W]] : [[0, W]];
    ctx.save();
    ctx.globalAlpha = 0.72;
    for (const [xa, xb] of segs) {
      const top = [proj(xa, IY1, FRONT_H), proj(xb, IY1, FRONT_H), proj(xb, H, FRONT_H), proj(xa, H, FRONT_H)];
      const face = [proj(xa, H, 0), proj(xb, H, 0), proj(xb, H, FRONT_H), proj(xa, H, FRONT_H)];
      poly(ctx, top, vGrad(ctx, top[0].y, top[2].y, b.wallTop, b.wallTopB));
      poly(ctx, face, vGrad(ctx, face[3].y, face[0].y, b.wallA, b.wallB));
      poly(ctx, top, null, 'rgba(255,255,255,0.9)', 1.2);
    }
    ctx.restore();
    if (room.doors.down) {
      const q = [proj(d0, H, 0), proj(d1, H, 0), proj(d1, IY1, 0), proj(d0, IY1, 0)];
      const col = doorColor(s, room, 'down');
      drawCube(ctx, d0 - 6, IY1 + 20, 0, 12, FRONT_H + 14, { top: '#ffffff', front: col, side: shade(col === '#ffffff' ? '#9fdcf2' : col, -0.3) });
      drawCube(ctx, d1 + 6, IY1 + 20, 0, 12, FRONT_H + 14, { top: '#ffffff', front: col, side: shade(col === '#ffffff' ? '#9fdcf2' : col, -0.3) });
      if (!room.cleared) {
        const g = [proj(d0, IY1 + 20, 0), proj(d1, IY1 + 20, 0), proj(d1, IY1 + 20, FRONT_H + 10), proj(d0, IY1 + 20, FRONT_H + 10)];
        poly(ctx, g, 'rgba(220,245,255,0.75)', 'rgba(255,255,255,0.95)', 2);
      } else {
        ctx.globalAlpha = 0.5; poly(ctx, q, 'rgba(63,196,255,0.4)'); ctx.globalAlpha = 1;
      }
    }
  }

  function enemyColor(e) {
    return { fly: '#ffb32b', orbiter: '#b678ff', grunt: '#7fe04a', turret: '#29c6d6', boss: '#ff4f8b' }[e.type];
  }

  const PLAYER_COL = { top: '#effdff', front: '#56d6ff', side: '#138fd6' };
  const GRUNT_COL = { top: '#f1ffd9', front: '#86e655', side: '#3a9e28' };
  const FLASH_COL = { top: '#ffffff', front: '#ffffff', side: '#e6f6ff' };
  const PEDESTAL_COL = { top: '#ffffff', front: '#dbe8f5', side: '#9fb4cc' };
  const GEL_COL = { top: '#eaffd2', front: '#7fea6a', side: '#2fa84a' };
  const HYPER_COLS = { 1: '#4fb8ff', 2: '#b07bff', 3: '#ff4f7a' };

  function lookDir(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }

  function drawPrism(ctx, e) {
    const h = e.size * 1.3, R = e.size * 0.5, cz = e.z + h / 2;
    const top = proj(e.x, e.y, e.z + h), bot = proj(e.x, e.y, e.z);
    const ringPts = [];
    for (let i = 0; i < 4; i++) {
      const a = e.spin + i * Math.PI / 2;
      ringPts.push({ wy: e.y + Math.sin(a) * R, p: proj(e.x + Math.cos(a) * R, e.y + Math.sin(a) * R, cz) });
    }
    const faces = [];
    for (let i = 0; i < 4; i++) {
      const a = ringPts[i], b = ringPts[(i + 1) % 4];
      faces.push({ depth: a.wy + b.wy, pts: [top, a.p, b.p], up: true, i });
      faces.push({ depth: a.wy + b.wy, pts: [bot, a.p, b.p], up: false, i });
    }
    faces.sort((u, v) => u.depth - v.depth);
    ctx.save();
    ctx.globalAlpha = e.alpha;
    for (const f of faces) {
      const c = e.flash > 0 ? '#ffffff' : f.i % 2 ? (f.up ? '#9ff0ff' : '#3fb8e8') : (f.up ? '#ffb3f0' : '#d14fd0');
      poly(ctx, f.pts, c, 'rgba(255,255,255,0.9)', 1.2);
    }
    ctx.globalAlpha = e.alpha * 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(top.x, top.y + h * 0.25, 5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawBoss(ctx, s, e) {
    const p = s.player, look = lookDir(e, p);
    if (e.kind === 'gelatao') {
      if (e.z > 650) return;
      const sq = e.squash;
      const r = drawCube(ctx, e.x, e.y, e.z, e.size, e.size * 0.85 * (1 - sq * 0.25), e.flash > 0 ? FLASH_COL : GEL_COL, 0.88, e.size * (1 + sq * 0.2));
      faceEyes(ctx, r.front, look, 1.1, '#0b3a1a');
      const f = r.front, mx = (f[0].x + f[1].x) / 2, my = f[0].y - (f[0].y - f[3].y) * 0.25;
      ctx.fillStyle = '#0b3a1a';
      ctx.beginPath(); ctx.ellipse(mx, my, 12 + sq * 8, 4 + (e.state === 'spit' ? sq * 10 : 0), 0, 0, TAU); ctx.fill();
    } else if (e.kind === 'duque') {
      const T = buildTextures();
      const c = drawSprite(ctx, T.duke, e.x, e.y, e.z + e.size * 0.12, e.size * 0.38);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(c.x - 16, c.y - c.r * 0.85); ctx.lineTo(c.x - 10, c.y - c.r - 14); ctx.lineTo(c.x - 3, c.y - c.r - 2);
      ctx.lineTo(c.x + 4, c.y - c.r - 16); ctx.lineTo(c.x + 10, c.y - c.r - 2); ctx.lineTo(c.x + 17, c.y - c.r - 12);
      ctx.lineTo(c.x + 16, c.y - c.r * 0.85); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff6c2'; ctx.lineWidth = 1.5; ctx.stroke();
      for (const side of [-1, 1]) {
        const ex = c.x + side * c.r * 0.35, ey = c.y + 2;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2a1060'; ctx.beginPath(); ctx.arc(ex + look.x * 2.5, ey + look.y * 2.5, 3.2, 0, TAU); ctx.fill();
      }
      drawSprite(ctx, T.bubble, e.x, e.y, e.z, e.size / 2, 0.9);
      if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 1.3, 0, TAU); ctx.fill(); }
    } else if (e.kind === 'prisma') {
      drawPrism(ctx, e);
    } else if (e.kind === 'hipercubo') {
      const col = HYPER_COLS[e.phase];
      const inner = e.size * (0.45 + Math.sin(e.spin) * 0.06);
      const ir = drawCube(ctx, e.x, e.y, e.z + e.size * 0.22, inner, inner, e.flash > 0 ? FLASH_COL : { top: '#ffffff', front: col, side: shade(col, -0.45) }, 1);
      faceEyes(ctx, ir.front, look, 1.2, '#1a0020');
      drawCube(ctx, e.x, e.y, e.z, e.size, e.size, { top: 'rgba(255,255,255,0.9)', front: shade(col, 0.55), side: shade(col, 0.1) }, 0.32);
      if (e.shield) drawSprite(ctx, buildTextures().bubble, e.x, e.y, e.z, e.size * 0.85, 0.9);
    }
  }

  function drawEnemy(ctx, s, e) {
    const T = buildTextures(), p = s.player, look = lookDir(e, p);
    if (e.type === 'boss') return drawBoss(ctx, s, e);
    if (e.type === 'fly' || e.type === 'orbiter') {
      const z = 18 + Math.sin(e.t * 5) * 4;
      const c = proj(e.x, e.y, z + e.size / 2), flap = Math.abs(Math.sin(e.t * 30));
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.ellipse(c.x - 9, c.y - 6, 7, 3 + flap * 3, -0.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(c.x + 9, c.y - 6, 7, 3 + flap * 3, 0.5, 0, TAU); ctx.fill();
      const o = drawSprite(ctx, e.type === 'fly' ? T.fly : T.orbiter, e.x, e.y, z, e.size / 2);
      ctx.fillStyle = '#2b1400';
      ctx.beginPath(); ctx.arc(o.x - 3 + look.x * 2, o.y + 1 + look.y * 2, 2, 0, TAU); ctx.arc(o.x + 3 + look.x * 2, o.y + 1 + look.y * 2, 2, 0, TAU); ctx.fill();
      if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill(); }
    } else if (e.type === 'grunt') {
      const wob = Math.sin(e.t * 8) * 2;
      const r = drawCube(ctx, e.x, e.y, 0, e.size, e.size * 0.85 + wob, e.flash > 0 ? FLASH_COL : GRUNT_COL, 0.92);
      faceEyes(ctx, r.front, look, 1, '#123d0a');
    } else if (e.type === 'turret') {
      drawCube(ctx, e.x, e.y, 0, e.size, 10, PEDESTAL_COL, 1);
      const o = drawSprite(ctx, T.turret, e.x, e.y, 10, e.size / 2 - 2);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(o.x + look.x * 3, o.y + look.y * 3, 5.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#062a38'; ctx.beginPath(); ctx.arc(o.x + look.x * 5, o.y + look.y * 5, 3, 0, TAU); ctx.fill();
      if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill(); }
    }
  }

  function drawPlayer(ctx, s) {
    const p = s.player;
    if (p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0) return;
    const moving = Math.hypot(p.vx, p.vy) > 20;
    const bob = moving ? Math.abs(Math.sin(s.time * 14)) * 4 : Math.sin(s.time * 3) + 1;
    const r = drawCube(ctx, p.x, p.y, bob, p.size, p.size, PLAYER_COL, 0.96);
    const d = DIRS[p.face];
    faceEyes(ctx, r.front, { x: d.dx, y: d.dy }, 1);
  }

  function drawItemPedestal(ctx, s, it) {
    drawCube(ctx, it.x, it.y, 0, 44, 16, PEDESTAL_COL, 1);
    if (it.taken) return;
    const def = ITEMS.find(i => i.id === it.id);
    const bob = 34 + Math.sin(s.time * 3) * 5;
    const glow = proj(it.x, it.y, bob + 12);
    const gg = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, 40);
    gg.addColorStop(0, 'rgba(255,255,255,0.8)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg; ctx.fillRect(glow.x - 40, glow.y - 40, 80, 80);
    drawCube(ctx, it.x, it.y, bob, 24, 24, { top: shade(def.color, 0.6), front: def.color, side: shade(def.color, -0.35) }, 0.95);
    // chegando perto mostra o que o item faz
    const p = s.player;
    if (Math.hypot(p.x - it.x, p.y - it.y) < 170) {
      const lp = proj(it.x, it.y, bob + 50);
      aeroText(ctx, def.name, lp.x, lp.y, 17);
      ctx.font = '13px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#0b4a75';
      ctx.fillText(def.desc, lp.x, lp.y + 17);
    }
  }

  function drawFamiliars(ctx, s, list) {
    const o = s.orbital, b = s.buddy;
    if (o) list.push({ y: o.y, draw: () => drawCube(ctx, o.x, o.y, 14, 16, 16, { top: '#fff8d6', front: '#ffd84a', side: '#c79a00' }, 1) });
    if (b) list.push({ y: b.y, draw: () => {
      const r = drawCube(ctx, b.x, b.y, 2, b.size, b.size, { top: '#fff0f7', front: '#ff8fc4', side: '#d0477f' }, 0.96);
      const d = DIRS[s.player.face];
      faceEyes(ctx, r.front, { x: d.dx, y: d.dy }, 1);
    } });
  }

  function drawItemIcons(ctx, s) {
    const items = s.player.items;
    items.forEach((id, i) => {
      const def = ITEMS.find(it => it.id === id), x = 12 + (i % 10) * 22, y = SCREEN_H - 28 - Math.floor(i / 10) * 22;
      ctx.fillStyle = def.color; ctx.beginPath(); ctx.roundRect(x, y, 18, 18, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, 14, 7, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(x, y, 18, 18, 5); ctx.stroke();
    });
  }

  function drawTrapdoor(ctx, s, t) {
    const h = t.size / 2;
    const q = [proj(t.x - h, t.y - h, 0), proj(t.x + h, t.y - h, 0), proj(t.x + h, t.y + h, 0), proj(t.x - h, t.y + h, 0)];
    poly(ctx, q, vGrad(ctx, q[0].y, q[2].y, '#062c4a', '#1c8fd0'), '#ffffff', 4);
    const c = proj(t.x, t.y, 0);
    ctx.save();
    ctx.translate(c.x, c.y); ctx.scale(1, YSCALE); ctx.rotate(s.time * 2);
    ctx.strokeStyle = 'rgba(160,240,255,0.8)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 8 + i * 7, i, i + 3.6); ctx.stroke(); }
    ctx.restore();
  }

  function drawLaser(ctx, l) {
    const e = laserEnd(l), a = proj(l.ox, l.oy, 22), b = proj(e.x, e.y, 22);
    ctx.save();
    ctx.lineCap = 'round';
    if (l.tele > 0) {
      ctx.strokeStyle = 'rgba(255,80,160,' + (0.35 + Math.sin(l.tele * 40) * 0.2) + ')';
      ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    } else {
      const k = sc((l.oy + e.y) / 2);
      ctx.strokeStyle = 'rgba(255,60,170,0.35)'; ctx.lineWidth = l.width * 1.8 * k;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,120,210,0.85)'; ctx.lineWidth = l.width * k;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = l.width * 0.35 * k;
      ctx.stroke();
    }
    ctx.restore();
  }

  function glossPanel(ctx, x, y, w, h, r, dark) {
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = dark
      ? vGrad(ctx, y, y + h, 'rgba(20,90,150,0.55)', 'rgba(5,40,80,0.65)')
      : vGrad(ctx, y, y + h, 'rgba(235,250,255,0.9)', 'rgba(110,200,245,0.85)');
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,' + (dark ? 0.18 : 0.55) + ')';
    ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h * 0.45, r * 0.8); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.stroke();
  }

  function aeroText(ctx, text, x, y, size, color, align) {
    ctx.font = '600 ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.95)'; ctx.shadowBlur = 6;
    ctx.fillStyle = color || '#0b4a75';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawHud(ctx, s) {
    const T = buildTextures(), p = s.player;
    glossPanel(ctx, 8, 6, W - 16, HUD - 12, 16);
    for (let i = 0; i < p.maxHp / 2; i++) {
      const x = 22 + i * 26, y = 11;
      ctx.drawImage(T.heartEmpty, x, y, 24, 24);
      const v = p.hp - i * 2;
      if (v >= 2) ctx.drawImage(T.heart, x, y, 24, 24);
      else if (v === 1) ctx.drawImage(T.heart, 0, 0, 16, 32, x, y, 12, 24);
    }
    if (s.godMode) aeroText(ctx, '★ Indestrutível', 30 + (p.maxHp / 2) * 26, 30, 14, '#c47a00', 'left');
    ctx.font = '12px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = '#0b4a75';
    ctx.fillText('Dano ' + p.dmg.toFixed(1) + '   Tiros/s ' + (1 / p.fireDelay).toFixed(1) +
      '   Vel ' + Math.round(p.speed) + (p.triple ? '   Triplo' : ''), 22, 50);
    aeroText(ctx, 'Andar ' + s.floor + ' · ' + biome(s).name, W / 2, 30, 18);
    ctx.font = '12px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#1d6ea3';
    ctx.fillText('abates: ' + s.kills + (activeMusic && activeMusic.started ? (activeMusic.muted ? '   ·   ♪ mudo (M)' : '   ·   ♪ música (M)') : ''), W / 2, 48);
    drawMinimap(ctx, s);
  }

  function drawMinimap(ctx, s) {
    const bx = W - 212, by = 10, bw = 196, bh = HUD - 20, cw = 16, ch = 10, g = 3;
    glossPanel(ctx, bx, by, bw, bh, 10, true);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.clip();
    const cx = bx + bw / 2, cy = by + bh / 2;
    for (const key in s.rooms) {
      const r = s.rooms[key];
      let known = r.visited;
      if (!known) for (const k in r.doors) {
        if (s.rooms[rk(r.x + DIRS[k].dx, r.y + DIRS[k].dy)].visited) known = true;
      }
      if (!known) continue;
      const x = cx + (r.x - s.cur.x) * (cw + g) - cw / 2, y = cy + (r.y - s.cur.y) * (ch + g) - ch / 2;
      const isCur = r.x === s.cur.x && r.y === s.cur.y;
      ctx.fillStyle = isCur ? '#ffffff' : r.visited ? 'rgba(160,225,255,0.9)' : 'rgba(160,225,255,0.3)';
      ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 3); ctx.fill();
      if (r.type === 'boss' || r.type === 'item') {
        ctx.fillStyle = r.type === 'boss' ? '#ff4f6d' : '#ffcf3a';
        ctx.beginPath(); ctx.arc(x + cw / 2, y + ch / 2, 3, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawBossBar(ctx, boss) {
    const w = 440, x = W / 2 - w / 2, y = SCREEN_H - 30;
    glossPanel(ctx, x, y, w, 20, 10, true);
    const f = clamp(boss.hp / boss.maxHp, 0, 1);
    if (f > 0) {
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x + 3, y + 3, (w - 6) * f, 14, 7); ctx.clip();
      ctx.fillStyle = vGrad(ctx, y, y + 20, '#ff9fc4', '#e0004f'); ctx.fillRect(x, y, w, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x, y + 3, w, 6);
      ctx.restore();
    }
    ctx.font = '600 12px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
    ctx.fillText(boss.name, W / 2, y + 14);
  }

  function centerPanel(ctx, title, sub) {
    ctx.fillStyle = 'rgba(10,50,90,0.4)'; ctx.fillRect(0, 0, W, SCREEN_H);
    glossPanel(ctx, W / 2 - 260, SCREEN_H / 2 - 70, 520, 130, 26);
    aeroText(ctx, title, W / 2, SCREEN_H / 2 - 12, 36);
    ctx.font = '16px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#1d6ea3';
    ctx.fillText(sub, W / 2, SCREEN_H / 2 + 26);
  }

  function drawAmbientBubbles(ctx, s, n, alpha, minR, maxR) {
    const T = buildTextures();
    for (let i = 0; i < n; i++) {
      const r = minR + ((i * 37) % 10) / 10 * (maxR - minR);
      const x = ((i * 173) % W) + Math.sin(s.time * 0.8 + i) * 24;
      const y = SCREEN_H + 40 - ((s.time * (16 + (i % 4) * 8) + i * 113) % (SCREEN_H + 80));
      ctx.globalAlpha = alpha;
      ctx.drawImage(T.bubble, x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawMenu(ctx, s) {
    const T = buildTextures();
    ctx.drawImage(T.sky, 0, 0);
    drawAmbientBubbles(ctx, s, 22, 0.7, 8, 30);
    // o herói: um cubo de vidro flutuando
    const bob = 30 + Math.sin(s.time * 2) * 10;
    const sh = proj(W / 2, 215, 0);
    ctx.fillStyle = 'rgba(10,60,110,0.18)';
    ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 40 - bob * 0.3, 12, 0, 0, TAU); ctx.fill();
    const r = drawCube(ctx, W / 2, 215, bob, 70, 70, PLAYER_COL, 0.96);
    faceEyes(ctx, r.front, { x: Math.sin(s.time), y: 0.3 }, 1);
    aeroText(ctx, 'Bloco de Isaac', W / 2, 120, 58);
    ctx.font = '18px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#0b4a75';
    ctx.fillText('Um roguelike de vidro em 3 andares', W / 2, 152);

    if (s.showHelp) {
      glossPanel(ctx, W / 2 - 250, 250, 500, 320, 24);
      aeroText(ctx, 'Controles', W / 2, 288, 26);
      ctx.font = '17px ' + FONT; ctx.fillStyle = '#0b4a75';
      const lines = ['WASD  —  mover o bloco', 'Setas  —  atirar bolhas', 'P  —  escudo de 10 s (recarga 20 s)', 'Esc  —  pausar', 'M  —  ligar/desligar música',
        'R  —  recomeçar depois de perder', 'Esc  —  voltar ao menu depois de perder'];
      lines.forEach((l, i) => ctx.fillText(l, W / 2, 322 + i * 30));
      ctx.font = '13px ' + FONT; ctx.fillStyle = '#1d6ea3';
      ctx.fillText('Enter ou Esc para voltar', W / 2, 553);
      return;
    }
    MENU_OPTIONS.forEach((label, i) => {
      const sel = i === s.menuIndex, w = sel ? 300 : 260, x = W / 2 - w / 2, y = 330 + i * 72;
      glossPanel(ctx, x, y, w, 54, 27, !sel);
      ctx.font = '600 ' + (sel ? 26 : 22) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = sel ? '#0b4a75' : '#e9f9ff';
      ctx.fillText((sel ? '▶  ' : '') + label, W / 2, y + 28);
      ctx.textBaseline = 'alphabetic';
    });
    ctx.font = '14px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#0b4a75';
    ctx.fillText('↑ ↓ ou W S para escolher  ·  Enter ou Espaço para confirmar', W / 2, 520);
    ctx.fillText('M  liga/desliga a música', W / 2, 542);
  }

  // Medidor do escudo (canto inferior direito)
  function drawShieldMeter(ctx, s) {
    const p = s.player, w = 176, h = 24, x = W - w - 12, y = SCREEN_H - h - 8;
    const active = p.shieldTime > 0, ready = !active && p.shieldCd <= 0;
    glossPanel(ctx, x, y, w, h, 12, !ready && !active);
    const f = active ? p.shieldTime / SHIELD_TIME : ready ? 1 : 1 - p.shieldCd / SHIELD_COOLDOWN;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x + 3, y + 3, Math.max(0, (w - 6) * f), h - 6, 9); ctx.clip();
    ctx.fillStyle = active ? vGrad(ctx, y, y + h, '#bff3ff', '#1fa8f0')
      : ready ? vGrad(ctx, y, y + h, '#d8ffd0', '#4cc23a')
      : vGrad(ctx, y, y + h, '#cfd8e3', '#7d8fa6'); // recarregando: cinza
    ctx.globalAlpha = ready || active ? 0.9 : 0.6;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.font = '600 12px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = ready || active ? '#0b4a75' : '#ffffff';
    const txt = active ? 'Escudo ativo: ' + Math.ceil(p.shieldTime) + ' s'
      : ready ? 'Escudo pronto (P)' : 'Escudo recarregando: ' + Math.ceil(p.shieldCd) + ' s';
    ctx.fillText(txt, x + w / 2, y + 16);
  }

  function drawCheatNotice(ctx, s) {
    ctx.fillStyle = 'rgba(10,50,90,0.45)'; ctx.fillRect(0, 0, W, SCREEN_H);
    const pw = 600, ph = 170, x = W / 2 - pw / 2, y = SCREEN_H / 2 - ph / 2;
    ctx.fillStyle = '#d6f1ff'; ctx.beginPath(); ctx.roundRect(x, y, pw, ph, 28); ctx.fill(); // fundo sólido
    glossPanel(ctx, x, y, pw, ph, 28);
    aeroText(ctx, '★ Parabéns, você ativou o código secreto! ★', W / 2, y + 62, 24, '#0b4a75');
    ctx.font = '17px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#1d6ea3';
    ctx.fillText('Seu bloco agora é indestrutível', W / 2, y + 98);
    ctx.font = '600 15px ' + FONT;
    ctx.fillText('O jogo começa em ' + Math.ceil(s.cheatNotice) + '...', W / 2, y + 132);
  }

  function render(ctx, s) {
    if (s.status === 'menu') {
      drawMenu(ctx, s);
      if (s.cheatNotice > 0) drawCheatNotice(ctx, s);
      return;
    }
    const T = buildTextures(), room = curRoom(s), p = s.player;
    ctx.save();
    ctx.drawImage(T.sky, 0, 0);
    drawAmbientBubbles(ctx, s, 14, 0.6, 6, 22);
    if (s.shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);

    drawFloor(ctx, s);
    if (room.type === 'start' && s.floor === 1) {
      ctx.save(); ctx.globalAlpha = 0.55;
      for (const [txt, y] of [['WASD  mover', H / 2 + 90], ['SETAS  atirar', H / 2 + 125], ['P  escudo   ·   Esc  pausar', H / 2 + 160]]) {
        const q = proj(W / 2, y, 0);
        aeroText(ctx, txt, q.x, q.y, 20, '#0b5a8a');
      }
      ctx.restore();
    }
    if (room.trapdoor) drawTrapdoor(ctx, s, room.trapdoor);

    // sombras no chão
    for (const r of room.rocks) drawShadow(ctx, r.x + r.w / 2 + 4, r.y + r.h / 2 + 6, 22, 0.18);
    for (const e of room.enemies) {
      let r = e.size / 2, a = 0.25;
      if (e.type === 'boss' && e.kind === 'gelatao' && e.z > 30) {
        const f = clamp(1 - e.z / 700, 0, 1); r *= 0.4 + 0.6 * f; a = 0.2 + 0.25 * f;
        const c = proj(e.x, e.y, 0);
        ctx.strokeStyle = 'rgba(255,60,120,' + (0.4 + Math.sin(s.time * 20) * 0.2) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(c.x, c.y, e.size / 2 * sc(e.y), e.size / 2 * sc(e.y) * YSCALE * 0.75, 0, 0, TAU); ctx.stroke();
      }
      drawShadow(ctx, e.x, e.y, r, a * (e.alpha === undefined ? 1 : e.alpha));
    }
    drawShadow(ctx, p.x, p.y, p.size / 2 + 2, 0.28);
    for (const t of s.tears) drawShadow(ctx, t.x, t.y, 5, 0.18);
    for (const b of s.bullets) drawShadow(ctx, b.x, b.y, b.size / 2 - 1, 0.18);

    drawWalls(ctx, s, room);

    // telegrafia da investida do Hipercubo
    for (const e of room.enemies) {
      if (e.type === 'boss' && e.state === 'chargeWind') {
        const end = laserEnd({ ox: e.x, oy: e.y, ang: e.cang });
        const a = proj(e.x, e.y, 2), b = proj(end.x, end.y, 2);
        ctx.strokeStyle = 'rgba(255,60,120,' + (0.3 + Math.sin(s.time * 30) * 0.15) + ')';
        ctx.lineWidth = e.size * 0.8 * sc(e.y);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }

    // entidades ordenadas por profundidade
    const list = [];
    const biomeRock = biome(s).rock;
    for (const r of room.rocks) list.push({ y: r.y + r.h / 2, draw: () => drawCube(ctx, r.x + r.w / 2, r.y + r.h / 2, 0, r.w - 2, 34, biomeRock, biomeRock.alpha) });
    for (const pk of room.pickups) list.push({ y: pk.y, draw: () => drawSprite(ctx, T.heart, pk.x, pk.y, 6 + Math.sin(s.time * 4) * 3, 12) });
    if (room.item) list.push({ y: room.item.y, draw: () => drawItemPedestal(ctx, s, room.item) });
    for (const e of room.enemies) list.push({ y: e.y, draw: () => {
      drawEnemy(ctx, s, e);
      if (e.frozen > 0) { // gelo da Bolha Gelada
        const c = proj(e.x, e.y, e.z + e.size / 2), r = e.size * 0.6 * sc(e.y);
        ctx.fillStyle = 'rgba(170,235,255,0.4)'; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    } });
    list.push({ y: p.y, draw: () => {
      drawPlayer(ctx, s);
      if (p.shieldUp) drawSprite(ctx, T.bubble, p.x, p.y, -4, p.size * 0.95, 0.85);
      if (p.shieldTime > 0) { // escudo P: bolha grande que pisca nos últimos 2 s
        const blink = p.shieldTime < 2 && Math.floor(p.shieldTime * 8) % 2 === 0;
        if (!blink) drawSprite(ctx, T.bubble, p.x, p.y, -10, p.size * 1.25 + Math.sin(s.time * 6) * 2, 1);
      }
    } });
    drawFamiliars(ctx, s, list);
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.draw();

    // projéteis e lasers
    for (const t of s.tears) {
      const z = 20 * Math.min(1, t.life / Math.min(0.2, t.max));
      drawSprite(ctx, T.tear, t.x, t.y, z, t.size / 2 + 1);
    }
    for (const b of s.bullets) drawSprite(ctx, T.bullet, b.x, b.y, 10, b.size / 2 + 1, b.wait > 0 ? 0.6 : 1);
    for (const l of s.lasers) drawLaser(ctx, l);

    drawFrontWall(ctx, s, room);

    for (const q of s.particles) {
      const c = proj(q.x, q.y, q.z);
      ctx.globalAlpha = q.life / q.max;
      ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(c.x, c.y, q.size / 2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(c.x - q.size * 0.15, c.y - q.size * 0.15, q.size * 0.18, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawAmbientBubbles(ctx, s, 6, 0.35, 10, 26);
    ctx.restore();

    const boss = room.enemies.find(e => e.type === 'boss');
    if (boss) drawBossBar(ctx, boss);
    drawItemIcons(ctx, s);
    drawShieldMeter(ctx, s);
    drawHud(ctx, s);
    if (s.msg && s.status === 'playing') {
      ctx.globalAlpha = Math.min(1, s.msg.t);
      aeroText(ctx, s.msg.title, W / 2, 190, 40);
      if (s.msg.sub) { ctx.font = '18px ' + FONT; ctx.fillStyle = '#0b4a75'; ctx.textAlign = 'center'; ctx.fillText(s.msg.sub, W / 2, 220); }
      ctx.globalAlpha = 1;
    }
    if (s.paused && s.status === 'playing') centerPanel(ctx, 'Pausa', 'Esc para continuar');
    if (s.status === 'dead') centerPanel(ctx, 'Você foi quebrado', 'Andar ' + s.floor + ' · ' + s.kills + ' abates · R recomeçar · Esc menu');
    if (s.status === 'won') centerPanel(ctx, 'Vitória cristalina!', s.kills + ' abates · R jogar de novo · Esc menu');
  }

  let activeMusic = null;
  function getMusic() { return activeMusic; }

  // Música: começa na primeira tecla (o navegador exige um gesto do usuário); M liga/desliga
  function bindMusic(target, music) {
    target.addEventListener('keydown', e => {
      if (e.repeat) return;
      music.start();
      if (e.code === 'KeyM') music.toggleMute();
    });
  }

  function start(canvas) {
    const ctx = canvas.getContext('2d');
    const s = createState(undefined, { menu: true });
    bindInput(s, window);
    if (global.BlockMusic) {
      if (activeMusic) activeMusic.stop();
      activeMusic = global.BlockMusic.createMusic();
      bindMusic(window, activeMusic);
    }
    let last = performance.now();
    function frame(now) {
      update(s, (now - last) / 1000);
      last = now;
      if (activeMusic) activeMusic.setIntensity(musicIntensity(s));
      render(ctx, s);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return s;
  }

  global.BlockGame = {
    W, H, HUD, WALL, TILE, IX0, IY0, IX1, IY1, DOOR, MAX_FLOOR, DIRS, ITEMS, BOSSES, BOSS_POOLS, BIOMES,
    SCREEN_H, WALL_H, PLAYER_DMG_BONUS, PLAYER_SPEED_BONUS, PLAYER_MAX_HP, ENEMY_HP_BONUS, BOSS_HP_MULT, MENU_OPTIONS, SECRET_CODE, CHEAT_NOTICE_TIME, SHIELD_TIME, SHIELD_COOLDOWN, musicIntensity, createState, startGame, update, render, setKey, bindInput, enterRoom, generateFloor,
    makeEnemy, curRoom, start, rk, proj, sc, buildTextures, laserEnd, getMusic, bindMusic,
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const c = document.getElementById('game');
      if (c) start(c);
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
