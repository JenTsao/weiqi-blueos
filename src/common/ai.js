/**
 * 围棋 AI 对弈决策引擎 (Weiqi AI Engine)
 *
 * 评估分两层：
 *   1. 局部战术 evaluateLocal  —— 提子、棋块气数、叫吃、连络、棋位偏好
 *   2. 全局势力 evaluateGlobal —— 每颗子向周围泼洒影响，得到全盘控制力场
 *
 * 三档难度共用同一套评分，区别只在选择阶段：
 *   新手(NOVICE)  加随机扰动，但不再自毁
 *   业余(MEDIUM)  取最高分附近的小范围随机
 *   高手(MASTER)  2-ply 预判：AI 最佳着 × 对方最佳应手
 */

import { EMPTY, BLACK, WHITE, playMove, getNeighbors, getGroup, isStarPoint } from './engine.js'

export const DIFFICULTY = {
  NOVICE: 'novice',
  MEDIUM: 'medium',
  MASTER: 'master',
}

/* ------------------------------------------------------------------ *
 * 全局势力场
 * ------------------------------------------------------------------ */

/** 每颗子向周围多大范围泼洒影响（切比雪夫半径） */
const INFLUENCE_RADIUS = 3

/** 按距离衰减的权重：越近影响越大 */
function influenceWeight(d) {
  if (d <= 1) return 12
  if (d === 2) return 5
  return 2
}

/**
 * 构建全盘影响场。每种颜色一张二维网格，
 * 记录「该点受该颜色多大影响」。
 * 采用泼洒式累加，复杂度 O(棋子数 × 半径²)，与棋盘总点数的平方无关。
 */
function buildInfluence(board) {
  const size = board.length
  const infl = {}
  infl[BLACK] = []
  infl[WHITE] = []
  for (let r = 0; r < size; r++) {
    infl[BLACK].push(new Array(size).fill(0))
    infl[WHITE].push(new Array(size).fill(0))
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const color = board[r][c]
      if (color === EMPTY) continue
      const grid = infl[color]
      for (let dr = -INFLUENCE_RADIUS; dr <= INFLUENCE_RADIUS; dr++) {
        const rr = r + dr
        if (rr < 0 || rr >= size) continue
        for (let dc = -INFLUENCE_RADIUS; dc <= INFLUENCE_RADIUS; dc++) {
          const cc = c + dc
          if (cc < 0 || cc >= size) continue
          const d = Math.max(Math.abs(dr), Math.abs(dc))
          if (d === 0) continue
          grid[rr][cc] += influenceWeight(d)
        }
      }
    }
  }
  return infl
}

/**
 * 某空点对指定一方的控制力：己方影响 - 对方影响(略微加权压制)
 * 以及是否已成单方实地
 */
function controlAt(infl, r, c, color) {
  const opp = color === BLACK ? WHITE : BLACK
  const mine = infl[color][r][c]
  const theirs = infl[opp][r][c]
  return {
    value: mine - theirs * 1.15,
    solid: mine >= 12 && theirs === 0,
  }
}

/* ------------------------------------------------------------------ *
 * 局部战术
 * ------------------------------------------------------------------ */

const ILLEGAL = -99999

/**
 * 判断某块棋在对手下一手能否被提掉。
 * @returns {{capturable:boolean}}
 *   captured —— 只剩1气且对手可立刻提
 */
function analyzeAtariRisk(board, group, oppColor, koPoint) {
  if (group.libertyCount === 0) return { captured: true }
  if (group.libertyCount > 1) return { captured: false }

  const lib = group.liberties[0]
  if (!lib) return { captured: false }

  // 对手能否直接提掉这一块
  const reply = playMove(board, lib.r, lib.c, oppColor, koPoint)
  return { captured: reply.success }
}

/* ------------------------------------------------------------------ *
 * 死活辅助：梯子读取 + 两眼活棋判定
 * ------------------------------------------------------------------ */

/**
 * 找出对方一手能把指定棋块压到 1 气的着法（叫吃）。
 * @returns {{board:number[][], group:object, captured:boolean}|null}
 *   captured 为 true 表示该着法直接把这块棋提掉了。
 */
function findAtariMove(board, group, oppColor) {
  for (let i = 0; i < group.liberties.length; i++) {
    const lib = group.liberties[i]
    const res = playMove(board, lib.r, lib.c, oppColor, null)
    if (!res.success) continue

    const anchor = group.stones[0]
    // 原本这块棋被提掉了
    if (res.newBoard[anchor.r][anchor.c] !== group.color) {
      return { board: res.newBoard, group: null, captured: true }
    }
    const target = getGroup(res.newBoard, anchor.r, anchor.c)
    if (target.libertyCount === 1) {
      return { board: res.newBoard, group: target, captured: false }
    }
  }
  return null
}

/**
 * 梯子读取：从 (r,c) 这块只剩一口气的棋出发，模拟双方轮流长气/叫吃，
 * 判断最终是逃掉还是被抓。
 *
 * 模型：每轮我方在某个气点长出第二气，对方立刻填掉一气再把我方压回
 * 1 气，如此往复。逃出 2 气且对方无法再叫吃即视为脱困。
 *
 * @returns {'escaped'|'caught'|'unknown'}
 */
function simulateLadder(board, r, c, maxSteps) {
  const oppColor = board[r][c] === BLACK ? WHITE : BLACK
  let b = board
  let grp = getGroup(b, r, c)
  const ownColor = grp.color

  for (let step = 0; step < maxSteps; step++) {
    if (grp.libertyCount >= 2) return 'escaped'
    if (grp.libertyCount === 0) return 'caught'

    // 我方长气：找一个能让这块棋涨到 2 气的点
    let grown = false
    for (let i = 0; i < grp.liberties.length; i++) {
      const lib = grp.liberties[i]
      const res = playMove(b, lib.r, lib.c, ownColor, null)
      if (!res.success) continue
      const ng = getGroup(res.newBoard, lib.r, lib.c)
      if (ng.libertyCount >= 2) {
        b = res.newBoard
        grp = ng
        grown = true
        break
      }
    }
    if (!grown) return 'caught'

    // 对方叫吃
    const atari = findAtariMove(b, grp, oppColor)
    if (!atari) return 'escaped' // 对方压不住我方
    if (atari.captured) return 'caught'
    b = atari.board
    grp = atari.group
  }
  // 步数用尽仍没分出结果：偏向保守，按不利处理
  return 'unknown'
}

/**
 * 计算某个棋块的「真眼」数量。>= 2 视为活棋。
 *
 * 真眼定义：一块完全被本方棋子围住的空区，且不与对方相邻。
 * 只统计 1~2 点的空区（真正的眼位），大空区另作处理。
 */
function countEyes(board, group) {
  const size = board.length
  const color = group.color
  const visited = new Set()
  let eyes = 0

  // 从本方棋子的四邻出发，flood fill 所有封闭空区
  for (let i = 0; i < group.stones.length; i++) {
    const s = group.stones[i]
    const neighbors = getNeighbors(s.r, s.c, size)
    for (let j = 0; j < neighbors.length; j++) {
      const n = neighbors[j]
      const key = `${n.r},${n.c}`
      if (board[n.r][n.c] !== EMPTY || visited.has(key)) continue

      // flood fill 该空区
      const stack = [n]
      visited.add(key)
      let area = 0
      let touchesOpponent = false

      while (stack.length > 0) {
        const cur = stack.pop()
        area++
        const curNeighbors = getNeighbors(cur.r, cur.c, size)
        for (let k = 0; k < curNeighbors.length; k++) {
          const nn = curNeighbors[k]
          const val = board[nn.r][nn.c]
          if (val === EMPTY) {
            const kk = `${nn.r},${nn.c}`
            if (!visited.has(kk)) {
              visited.add(kk)
              stack.push(nn)
            }
          } else if (val !== color) {
            touchesOpponent = true
          }
        }
      }

      // 不与对方相邻，且足够小 —— 算一个真眼
      if (!touchesOpponent && area <= 2) eyes++
      if (eyes >= 2) return 2
    }
  }
  return eyes
}

/**
 * 判断某块棋是否已经活透（两眼）。
 */
function isAlive(board, group) {
  return countEyes(board, group) >= 2
}

/**
 * 评估一个落子点的局部战术分
 */
function evaluateLocal(board, r, c, aiColor, koPoint) {
  const size = board.length
  const oppColor = aiColor === BLACK ? WHITE : BLACK

  const sim = playMove(board, r, c, aiColor, koPoint)
  if (!sim.success) return ILLEGAL

  const newBoard = sim.newBoard
  let score = 0

  // 1. 提子收益：吃掉一子是既成事实，叫吃只是威胁。
  //    权重要保证「直接提」稳定压过「叫吃一手」，否则 AI 会为了叫吃
  //    放弃已经到手的棋（实测两着分值接近时会随机选到叫吃那手）。
  if (sim.captured > 0) {
    score += sim.captured * 180 + 40
  }

  const myGroup = getGroup(newBoard, r, c)

  // 2. 自身棋块气数
  if (myGroup.libertyCount === 1) {
    score -= 60 // 有点危险，先轻罚，真正的重罚见下面 atari 风险
  } else if (myGroup.libertyCount === 2) {
    score += 18
  } else if (myGroup.libertyCount >= 3) {
    score += 38
  }

  // 3. 自投罗网 / 梯子：落子后己方块能被对手立刻提掉
  if (myGroup.libertyCount <= 1) {
    const risk = analyzeAtariRisk(newBoard, myGroup, oppColor, sim.koPoint)
    if (risk.captured) {
      // 越小的一块被吃掉，损失越小；大块被吃则重罚
      score -= 260 + myGroup.stones.length * 40
    } else if (myGroup.stones.length >= 2) {
      // 对手不能立刻提（多见于提子后形成的一气），
      // 但继续跑会不会进梯子？读一手。大棋盘少读几步控制开销。
      const ladder = simulateLadder(newBoard, r, c, size <= 9 ? 8 : 6)
      if (ladder === 'caught') {
        score -= 240
      } else if (ladder === 'unknown') {
        score -= 70
      }
    }
  }

  const preNeighbors = getNeighbors(r, c, size)

  // 4. 救子：此处能让己方 1 气的棋块获得 2 气以上
  const seenMyGroups = new Set()
  let rescued = 0
  for (let i = 0; i < preNeighbors.length; i++) {
    const { r: nr, c: nc } = preNeighbors[i]
    if (board[nr][nc] !== aiColor) continue
    const grp = getGroup(board, nr, nc)
    const rep = `${grp.stones[0].r},${grp.stones[0].c}`
    if (seenMyGroups.has(rep)) continue
    seenMyGroups.add(rep)
    if (grp.libertyCount === 1 && myGroup.libertyCount > 1) {
      rescued++
      score += 150
    }
  }

  // 5. 叫吃：落子后把对方棋块压到 1 气
  const seenOppGroups = new Set()
  let atari = 0
  let atariStones = 0
  for (let i = 0; i < preNeighbors.length; i++) {
    const { r: nr, c: nc } = preNeighbors[i]
    if (newBoard[nr][nc] !== oppColor) continue
    const grp = getGroup(newBoard, nr, nc)
    const rep = `${grp.stones[0].r},${grp.stones[0].c}`
    if (seenOppGroups.has(rep)) continue
    seenOppGroups.add(rep)
    if (grp.libertyCount === 1) {
      atari++
      atariStones += grp.stones.length
      score += 50
    }
  }
  // 叫吃一块大棋价值更高（对方逃不掉就等于死）
  if (atari > 0) {
    score += Math.min(atariStones, 8) * 6
  }

  // 6. 棋位偏好（金角银边草肚皮）
  const dEdgeR = Math.min(r, size - 1 - r)
  const dEdgeC = Math.min(c, size - 1 - c)
  const line = Math.min(dEdgeR, dEdgeC)

  if (isStarPoint(size, r, c)) score += 40

  if (line === 0) {
    if (sim.captured === 0 && atari === 0) score -= 45
  } else if (line === 1) {
    score += 10
  } else if (line === 2) {
    score += 30
  } else if (line === 3) {
    score += 24
  }

  // 7. 连络：连接两个原本独立的己方棋块
  if (seenMyGroups.size >= 2) {
    score += 40
  }

  // 8. 贴着自己的棋走（配合），但不重复奖励已经成型的块
  for (let i = 0; i < preNeighbors.length; i++) {
    const { r: nr, c: nc } = preNeighbors[i]
    if (board[nr][nc] === aiColor) {
      const grp = getGroup(board, nr, nc)
      if (grp.libertyCount >= 2 && grp.stones.length <= 6) {
        score += 8
      }
    }
  }

  return score
}

/* ------------------------------------------------------------------ *
 * 综合评分
 * ------------------------------------------------------------------ */

/**
 * 全局势力分：占据该点带来的控制力收益 + 单方实地奖励
 */
function evaluateGlobal(infl, r, c, color) {
  const ctrl = controlAt(infl, r, c, color)
  let s = ctrl.value
  if (ctrl.solid) s += 12
  return s
}

/**
 * 对给定局面综合评估一个点
 */
function scoreMove(board, infl, r, c, aiColor, koPoint, globalWeight) {
  const local = evaluateLocal(board, r, c, aiColor, koPoint)
  if (local === ILLEGAL) return ILLEGAL
  const global = evaluateGlobal(infl, r, c, aiColor)
  return local + globalWeight * global
}

/**
 * 枚举全部合法着并评分，按分值降序返回
 */
function rankMoves(board, infl, aiColor, koPoint, globalWeight) {
  const size = board.length
  const list = []
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== EMPTY) continue
      const score = scoreMove(board, infl, r, c, aiColor, koPoint, globalWeight)
      if (score !== ILLEGAL) list.push({ r, c, score })
    }
  }
  list.sort((a, b) => b.score - a.score)
  return list
}

/* ------------------------------------------------------------------ *
 * 各档难度的选择策略
 * ------------------------------------------------------------------ */

/** 新手：加随机扰动，但保留基本的安全下限 */
function chooseNovice(list) {
  if (list.length === 0) return null

  // 有大棋可提就提
  const captures = list.filter((m) => m.score >= 100)
  if (captures.length > 0 && Math.random() < 0.75) {
    return captures[Math.floor(Math.random() * captures.length)]
  }

  // 45% 概率在前 6 个候选里随机（故意犯错）
  if (Math.random() < 0.45) {
    const pool = list.slice(0, Math.min(6, list.length))
    return pool[Math.floor(Math.random() * pool.length)]
  }

  // 55% 概率从「不会立刻被提」的着法里随机
  const safe = list.filter((m) => m.score > -60)
  const pool = safe.length > 0 ? safe : list
  return pool[Math.floor(Math.random() * pool.length)]
}

/** 业余：最高分附近小范围随机 */
function chooseMedium(list) {
  if (list.length === 0) return null
  const best = list[0].score
  const topTier = list.filter((m) => best - m.score <= 20)
  return topTier[Math.floor(Math.random() * topTier.length)]
}

/**
 * 整盘形势评估：从 color 视角给当前局面打分。
 *
 * 关键在于**子力按死活状态折算**：
 *   - 两眼活棋      按足额计（3/子）
 *   - 尚未死定      折半计（1.5/子）
 *   - 只剩1气且对方能直接提  只计 0.2/子（马上就要没了）
 *
 * 若一律按 3/子 计，AI 会把「一堆快被提掉的死子」和「两块真活棋」
 * 看成等价，从而去救死子、放着必丢的棋不管。数子规则下这是硬伤。
 *
 * 子力按棋块统计而非逐子，避免同一块棋被重复判眼。
 */
function evaluatePosition(board, color) {
  const size = board.length
  const opp = color === BLACK ? WHITE : BLACK
  const infl = buildInfluence(board)
  const komi = size === 13 ? 7.5 : 3.75

  let score = 0

  // 1. 空点的控制力
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== EMPTY) continue
      score += controlAt(infl, r, c, color).value * 0.5
    }
  }

  // 2. 子力（按棋块死活折算）
  const seen = new Set()
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = board[r][c]
      if (v === EMPTY || seen.has(`${r},${c}`)) continue

      const grp = getGroup(board, r, c)
      for (let i = 0; i < grp.stones.length; i++) {
        seen.add(`${grp.stones[i].r},${grp.stones[i].c}`)
      }

      let unit
      if (isAlive(board, grp)) {
        unit = 3 // 活棋，足额
      } else if (grp.libertyCount <= 1) {
        // 1 气：对方下一手通常就能提掉，价值极低
        const risk = analyzeAtariRisk(board, grp, v === BLACK ? WHITE : BLACK, null)
        unit = risk.captured ? 0.2 : 1
      } else {
        unit = 1.5 // 未定形，折半
      }

      score += (v === color ? 1 : -1) * grp.stones.length * unit
    }
  }

  // 白棋贴目优势，等价于给白棋加分
  if (color === WHITE) score += komi

  return score
}

/**
 * 高手：2-ply 预判。
 *
 * 先用「局部战术分」筛出候选池（保证进入搜索的着法本身站得住），
 * 再对每个候选着法模拟双方各一手，比较终局的整盘形势：
 *   value = min over 对方应手 { evaluatePosition(我方走完 + 对方应手后) }
 *
 * 注意不能用「对方应手的着法分」做惩罚——那个分数里绝大部分是对方
 * 本来就能拿到的，与这手棋无关，会把所有吃子/叫吃的着法一并压低。
 *
 * 取舍 = 局部战术分 + 形势相对增量：
 *   value = move.score + (最坏终局形势 - 当前形势)
 * 形势分只用于在战术分接近的着法之间做全局取舍，不取代战术判断。
 * 若只用形势分，AI 会看不见「逃气」「叫吃」这类局部生死。
 *
 * 为控制手表端算力，对方应手只在 AI 落点附近搜索，范围见 searchBudget。
 */

/**
 * 搜索预算按棋盘大小缩放。
 *
 * evaluatePosition 的调用次数 = 候选数 × (1 + 应手数)，而它内部还要建势力场
 * 并逐块判眼，开销随盘面迅速放大。不限量的话桌面 13 路要 13.6ms/手，
 * 挪到手表端会顶破 320ms 的走子间隔。
 */
function searchBudget(size) {
  if (size <= 9) return { pool: 6, radius: 2, ladderSteps: 8 }
  return { pool: 4, radius: 1, ladderSteps: 6 }
}
function chooseMaster(board, list, aiColor, koPoint) {
  if (list.length === 0) return null

  const size = board.length
  const oppColor = aiColor === BLACK ? WHITE : BLACK
  const budget = searchBudget(size)
  const POOL = budget.pool
  const REPLY_RADIUS = budget.radius

  // 所有候选共用的基准形势
  const basePos = evaluatePosition(board, aiColor)

  const pool = list.slice(0, Math.min(POOL, list.length))
  let bestMove = pool[0]
  let bestValue = -Infinity

  for (let i = 0; i < pool.length; i++) {
    const move = pool[i]
    const sim = playMove(board, move.r, move.c, aiColor, koPoint)
    if (!sim.success) continue

    const after = sim.newBoard

    // 我方走完这一手时的形势
    let worst = evaluatePosition(after, aiColor)

    // 枚举对方在附近的应手，取对我方最不利的结果
    for (let dr = -REPLY_RADIUS; dr <= REPLY_RADIUS; dr++) {
      for (let dc = -REPLY_RADIUS; dc <= REPLY_RADIUS; dc++) {
        const rr = move.r + dr
        const cc = move.c + dc
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue
        if (after[rr][cc] !== EMPTY) continue

        const rsim = playMove(after, rr, cc, oppColor, sim.koPoint)
        if (!rsim.success) continue

        const v = evaluatePosition(rsim.newBoard, aiColor)
        if (v < worst) worst = v
      }
    }

    const value = move.score + (worst - basePos)
    if (value > bestValue) {
      bestValue = value
      bestMove = move
    }
  }

  return bestMove
}

/* ------------------------------------------------------------------ *
 * 对外接口
 * ------------------------------------------------------------------ */

/**
 * 获得 AI 的下一步落子
 * @param {number[][]} board 当前棋盘
 * @param {number} aiColor AI 执子颜色
 * @param {string} difficulty 难度级别
 * @param {{r:number,c:number}|null} koPoint 打劫禁着点
 * @returns {{r:number,c:number}|null} 落子坐标，返回 null 表示停一手
 */
export function getAIMove(board, aiColor, difficulty = DIFFICULTY.MEDIUM, koPoint = null) {
  const infl = buildInfluence(board)

  // 新手不做全局判断，只用局部战术，避免它在开阔处乱走
  const globalWeight = difficulty === DIFFICULTY.NOVICE ? 0.6 : 2.0

  const list = rankMoves(board, infl, aiColor, koPoint, globalWeight)

  if (list.length === 0) return null // 无路可下

  // 全盘皆无正收益着法时停一手
  if (list[0].score < -120) return null

  if (difficulty === DIFFICULTY.NOVICE) return chooseNovice(list)
  if (difficulty === DIFFICULTY.MEDIUM) return chooseMedium(list)
  return chooseMaster(board, list, aiColor, koPoint)
}