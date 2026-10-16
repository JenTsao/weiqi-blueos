/**
 * 围棋 AI 对弈决策引擎 (Weiqi AI Engine)
 * 提供三种难度：
 * 1. 新手入门 (Novice): 侧重简单提子与随机探索
 * 2. 业余中级 (Medium): 叫吃攻防、死活避险、金角银边、连络分断
 * 3. 精湛高手 (Master): 综合战术评分 + 对手反击预测评估，稳健占空与杀气
 */

import { EMPTY, BLACK, WHITE, playMove, getNeighbors, getGroup, isStarPoint } from './engine.js'

export const DIFFICULTY = {
  NOVICE: 'novice',
  MEDIUM: 'medium',
  MASTER: 'master',
}

/**
 * 评估一个落子点的基础战术分值
 */
function evaluateMoveTactics(board, r, c, aiColor, koPoint) {
  const size = board.length
  const oppColor = aiColor === BLACK ? WHITE : BLACK

  // 1. 尝试落子
  const sim = playMove(board, r, c, aiColor, koPoint)
  if (!sim.success) return -99999

  let score = 0
  const newBoard = sim.newBoard

  // 2. 提子收益 (每提一子奖励极大)
  if (sim.captured > 0) {
    score += sim.captured * 140
  }

  // 3. 自身落子后的棋块安全度
  const myGroup = getGroup(newBoard, r, c)

  if (myGroup.libertyCount === 1) {
    // 自投罗网 (Self-Atari): 如果只剩1气且没有吃掉对方多子，极易被反提
    if (sim.captured < 2) {
      score -= 180
    }
  } else if (myGroup.libertyCount === 2) {
    score += 15
  } else if (myGroup.libertyCount >= 3) {
    score += 35
  }

  // 4. 救子防守：判断落子前此处是否是己方处于叫吃(1气)状态的救急点
  const preNeighbors = getNeighbors(r, c, size)
  for (let i = 0; i < preNeighbors.length; i++) {
    const { r: nr, c: nc } = preNeighbors[i]
    if (board[nr][nc] === aiColor) {
      const oldGroup = getGroup(board, nr, nc)
      if (oldGroup.libertyCount === 1) {
        // 这一手能把1气的棋救活（增加气）
        if (myGroup.libertyCount > 1) {
          score += 130
        }
      }
    }
  }

  // 5. 叫吃反击：判断落子后是否使对方棋块变成1气 (叫吃)
  const afterNeighbors = getNeighbors(r, c, size)
  for (let i = 0; i < afterNeighbors.length; i++) {
    const { r: nr, c: nc } = afterNeighbors[i]
    if (newBoard[nr][nc] === oppColor) {
      const oppGroup = getGroup(newBoard, nr, nc)
      if (oppGroup.libertyCount === 1) {
        score += 70 // 叫吃对方
      }
    }
  }

  // 6. 形状与棋位偏好 (金角银边草肚皮)
  const dEdgeR = Math.min(r, size - 1 - r)
  const dEdgeC = Math.min(c, size - 1 - c)
  const line = Math.min(dEdgeR, dEdgeC)

  // 星位与天元
  if (isStarPoint(size, r, c)) {
    score += 40
  }

  if (line === 0) {
    // 一路（死亡线）：前期不宜下一路，除非提子或绝妙连络
    if (sim.captured === 0) {
      score -= 40
    }
  } else if (line === 1) {
    // 二路（败线/收官线）
    score += 8
  } else if (line === 2) {
    // 三路（实地线/黄金开局线）
    score += 28
  } else if (line === 3) {
    // 四路（势力线）
    score += 22
  }

  // 7. 连络加分：如果连接了两个原本独立的己方棋块
  let connectedFriendlyBlocks = 0
  const seenGroupKeys = new Set()
  for (let i = 0; i < preNeighbors.length; i++) {
    const { r: nr, c: nc } = preNeighbors[i]
    if (board[nr][nc] === aiColor) {
      const grp = getGroup(board, nr, nc)
      const repKey = `${grp.stones[0].r},${grp.stones[0].c}`
      if (!seenGroupKeys.has(repKey)) {
        seenGroupKeys.add(repKey)
        connectedFriendlyBlocks++
      }
    }
  }
  if (connectedFriendlyBlocks >= 2) {
    score += 35 // 关键连络点
  }

  return score
}

/**
 * 获得 AI 的下一步落子
 * @param {number[][]} board 当前棋盘
 * @param {number} aiColor AI执子颜色
 * @param {string} difficulty 难度级别
 * @param {{r: number, c: number}|null} koPoint 打劫禁着点
 * @returns {{r: number, c: number}|null} 落子坐标，若返回 null 则表示停一手 (Pass)
 */
export function getAIMove(board, aiColor, difficulty = DIFFICULTY.MEDIUM, koPoint = null) {
  const size = board.length
  const oppColor = aiColor === BLACK ? WHITE : BLACK
  const candidates = []

  // 收集所有合法落子点并打分
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === EMPTY) {
        const score = evaluateMoveTactics(board, r, c, aiColor, koPoint)
        if (score > -9999) {
          candidates.push({ r, c, score })
        }
      }
    }
  }

  if (candidates.length === 0) {
    return null // 无路可下，停一手
  }

  // 按得分从高到低排序
  candidates.sort((a, b) => b.score - a.score)

  // 如果最高分都很低（比如负很多），说明全局已定，停一手
  if (candidates[0].score < -100) {
    return null
  }

  // 根据不同难度策略选择着法
  if (difficulty === DIFFICULTY.NOVICE) {
    // 新手：如果有可直接提子的大招（分值很高），优先提子；
    // 否则有 40% 概率在前 5 个点中随机选，或者完全随机探索
    const topCaptures = candidates.filter((m) => m.score >= 100)
    if (topCaptures.length > 0 && Math.random() < 0.8) {
      return topCaptures[Math.floor(Math.random() * topCaptures.length)]
    }

    if (Math.random() < 0.45) {
      // 随机在前 6 个候选中选一个
      const pool = candidates.slice(0, Math.min(6, candidates.length))
      return pool[Math.floor(Math.random() * pool.length)]
    } else {
      // 纯从合法步中挑个不自杀的
      const safeMoves = candidates.filter((m) => m.score > -50)
      if (safeMoves.length > 0) {
        return safeMoves[Math.floor(Math.random() * safeMoves.length)]
      }
      return candidates[0]
    }
  }

  if (difficulty === DIFFICULTY.MEDIUM) {
    // 业余中级：在前 3 个高分且分值接近（差距小于 15 分）的动作中做轻度随机，避免千篇一律
    const bestScore = candidates[0].score
    const topTier = candidates.slice(0, 3).filter((m) => bestScore - m.score <= 15)
    return topTier[Math.floor(Math.random() * topTier.length)]
  }

  // 精湛高手 (Master):
  // 在前 5 个候选落子中做对手最佳反击预判 (1-ply Minimax Lookahead)
  const masterPool = candidates.slice(0, Math.min(5, candidates.length))
  let bestMasterMove = masterPool[0]
  let bestAdjustedScore = -999999

  for (let i = 0; i < masterPool.length; i++) {
    const move = masterPool[i]
    const sim = playMove(board, move.r, move.c, aiColor, koPoint)
    if (!sim.success) continue

    // 假设 AI 走完后，对方在这个局面下能得到的最高反击得分
    let maxOppCounterScore = 0
    const oppNeighbors = getNeighbors(move.r, move.c, size)
    // 采样对方可能反击的候选点（主要是局部冲突点）
    for (let j = 0; j < oppNeighbors.length; j++) {
      const { r: or, c: oc } = oppNeighbors[j]
      if (sim.newBoard[or][oc] === EMPTY) {
        const oppScore = evaluateMoveTactics(sim.newBoard, or, oc, oppColor, sim.koPoint)
        if (oppScore > maxOppCounterScore) {
          maxOppCounterScore = oppScore
        }
      }
    }

    // 综合得分 = AI自身战术分 - 对方局部最佳反击分 * 0.6
    const adjustedScore = move.score - maxOppCounterScore * 0.6
    if (adjustedScore > bestAdjustedScore) {
      bestAdjustedScore = adjustedScore
      bestMasterMove = move
    }
  }

  return { r: bestMasterMove.r, c: bestMasterMove.c }
}
