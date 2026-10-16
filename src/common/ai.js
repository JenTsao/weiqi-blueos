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
 * @returns {{capturable:boolean, escapeBad:boolean}}
 *   captured   —— 只剩1气且对手可立刻提
 *   escapeBad  —— 逃也逃不掉（简单梯子识别）
 */
function analyzeAtariRisk(board, group, oppColor, koPoint) {
  if (group.libertyCount === 0) return { captured: true, escapeBad: true }
  if (group.libertyCount > 1) return { captured: false, escapeBad: false }

  // 只剩 1 气
  const lib = group.liberties[0]
  if (!lib) return { captured: false, escapeBad: false }

  // 对手能否直接提掉这一块
  const reply = playMove(board, lib.r, lib.c, oppColor, koPoint)
  if (reply.success) {
    return { captured: true, escapeBad: true }
  }

  // 对手无法直接提（该气点本身是禁着点，打劫情形），
  // 不作梯子惩罚，避免误判
  return { captured: false, escapeBad: false }
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
 * 子力 + 全盘控制力 + 贴目补偿。
 * 这是 2-ply 搜索真正用来比较优劣的函数。
 */
function evaluatePosition(board, color) {
  const size = board.length
  const opp = color === BLACK ? WHITE : BLACK
  const infl = buildInfluence(board)
  const komi = size === 13 ? 7.5 : 3.75

  let score = 0
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = board[r][c]
      if (v === color) {
        score += 3 // 子力
      } else if (v === opp) {
        score -= 3
      } else {
        score += controlAt(infl, r, c, color).value * 0.5
      }
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
 * 为控制手表端算力，对方应手只在 AI 落点附近半径 2 内搜索。
 */
function chooseMaster(board, list, aiColor, koPoint) {
  if (list.length === 0) return null

  const size = board.length
  const oppColor = aiColor === BLACK ? WHITE : BLACK
  const POOL = 6
  const REPLY_RADIUS = 2

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