/**
 * 围棋核心规则引擎 (Go Rules Engine)
 * 支持 7路/9路/13路 棋盘、气计算、提子、禁着点检测、打劫规则判定、数子胜负结算
 */

export const EMPTY = 0
export const BLACK = 1
export const WHITE = 2

// 棋盘路坐标显示字母 (跳过'I'避免与数字1混淆)
export const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N']

/**
 * 创建指定大小的空棋盘
 * @param {number} size 棋盘大小，默认 9
 * @returns {number[][]}
 */
export function createBoard(size = 9) {
  const board = []
  for (let r = 0; r < size; r++) {
    const row = []
    for (let c = 0; c < size; c++) {
      row.push(EMPTY)
    }
    board.push(row)
  }
  return board
}

/**
 * 获取星位坐标
 * @param {number} size 棋盘大小
 * @returns {Array<{r: number, c: number}>}
 */
export function getStarPoints(size) {
  if (size === 7) {
    return [
      { r: 2, c: 2 },
      { r: 2, c: 4 },
      { r: 4, c: 2 },
      { r: 4, c: 4 },
      { r: 3, c: 3 },
    ]
  } else if (size === 9) {
    return [
      { r: 2, c: 2 },
      { r: 2, c: 6 },
      { r: 6, c: 2 },
      { r: 6, c: 6 },
      { r: 4, c: 4 },
    ]
  } else if (size === 13) {
    return [
      { r: 3, c: 3 },
      { r: 3, c: 9 },
      { r: 9, c: 3 },
      { r: 9, c: 9 },
      { r: 6, c: 6 },
    ]
  }
  return []
}

/**
 * 判断坐标是否是星位
 */
export function isStarPoint(size, r, c) {
  const stars = getStarPoints(size)
  return stars.some((p) => p.r === r && p.c === c)
}

/**
 * 获取相邻十字交叉点
 */
export function getNeighbors(r, c, size) {
  const neighbors = []
  if (r > 0) neighbors.push({ r: r - 1, c })
  if (r < size - 1) neighbors.push({ r: r + 1, c })
  if (c > 0) neighbors.push({ r, c: c - 1 })
  if (c < size - 1) neighbors.push({ r, c: c + 1 })
  return neighbors
}

/**
 * BFS 查找由相连同色棋子组成的棋块 (Group) 及其所有气 (Liberties)
 */
export function getGroup(board, startR, startC) {
  const size = board.length
  const color = board[startR][startC]
  if (color === EMPTY) {
    return { stones: [], liberties: [], libertyCount: 0, color: EMPTY }
  }

  const visitedStones = new Set()
  const liberties = new Set()
  const queue = [{ r: startR, c: startC }]
  visitedStones.add(`${startR},${startC}`)
  const stones = [{ r: startR, c: startC }]

  // 用游标而非 queue.shift()：shift() 是 O(n)，
  // 每次 AI 评估要调用 getGroup 近 10 次，累积成明显的额外开销
  let head = 0
  while (head < queue.length) {
    const { r, c } = queue[head++]
    const neighbors = getNeighbors(r, c, size)

    for (let i = 0; i < neighbors.length; i++) {
      const { r: nr, c: nc } = neighbors[i]
      const nColor = board[nr][nc]
      const key = `${nr},${nc}`

      if (nColor === EMPTY) {
        liberties.add(key)
      } else if (nColor === color && !visitedStones.has(key)) {
        visitedStones.add(key)
        stones.push({ r: nr, c: nc })
        queue.push({ r: nr, c: nc })
      }
    }
  }

  const libArray = []
  liberties.forEach((k) => {
    const parts = k.split(',')
    libArray.push({ r: parseInt(parts[0], 10), c: parseInt(parts[1], 10) })
  })

  return {
    stones,
    liberties: libArray,
    libertyCount: liberties.size,
    color,
  }
}

/**
 * 尝试落子并处理提子与合法性规则
 * @param {number[][]} board 棋盘状态
 * @param {number} r 行 (0-indexed)
 * @param {number} c 列 (0-indexed)
 * @param {number} color 棋子颜色 (BLACK 或 WHITE)
 * @param {{r: number, c: number}|null} koPoint 当前打劫禁着点
 * @returns {{success: boolean, newBoard?: number[][], captured?: number, koPoint?: {r: number, c: number}|null, error?: string}}
 */
export function playMove(board, r, c, color, koPoint = null) {
  const size = board.length

  // 1. 越界检查
  if (r < 0 || r >= size || c < 0 || c >= size) {
    return { success: false, error: '落子越界' }
  }

  // 2. 已有子检查
  if (board[r][c] !== EMPTY) {
    return { success: false, error: '该位置已有棋子' }
  }

  // 3. 打劫禁着点检查 (Ko rule)
  if (koPoint && koPoint.r === r && koPoint.c === c) {
    return { success: false, error: '劫争禁着点，需隔一手方可回提' }
  }

  // 4. 复制棋盘模拟落子
  const newBoard = board.map((row) => [...row])
  newBoard[r][c] = color

  const opponentColor = color === BLACK ? WHITE : BLACK
  const neighbors = getNeighbors(r, c, size)

  // 5. 检查对方邻接气为0的棋块 (提子)
  let capturedStones = []
  const processedOpponentKeys = new Set()

  for (let i = 0; i < neighbors.length; i++) {
    const { r: nr, c: nc } = neighbors[i]
    if (newBoard[nr][nc] === opponentColor) {
      const key = `${nr},${nc}`
      if (!processedOpponentKeys.has(key)) {
        const oppGroup = getGroup(newBoard, nr, nc)
        oppGroup.stones.forEach((s) => processedOpponentKeys.add(`${s.r},${s.c}`))

        if (oppGroup.libertyCount === 0) {
          // 该块气绝，提子
          capturedStones = capturedStones.concat(oppGroup.stones)
        }
      }
    }
  }

  let nextKoPoint = null

  if (capturedStones.length > 0) {
    // 移除被提掉的棋子
    for (let i = 0; i < capturedStones.length; i++) {
      const stone = capturedStones[i]
      newBoard[stone.r][stone.c] = EMPTY
    }

    // 6. 判断是否形成打劫 (落子1颗且提对方1颗，且落子后己方只有1气)
    if (capturedStones.length === 1) {
      const myGroup = getGroup(newBoard, r, c)
      if (myGroup.stones.length === 1 && myGroup.libertyCount === 1) {
        nextKoPoint = { r: capturedStones[0].r, c: capturedStones[0].c }
      }
    }
  } else {
    // 7. 无提子时，检查自身是否无气 (自杀禁止规则)
    const myGroup = getGroup(newBoard, r, c)
    if (myGroup.libertyCount === 0) {
      return { success: false, error: '此处无气，禁着点' }
    }
  }

  return {
    success: true,
    newBoard,
    captured: capturedStones.length,
    koPoint: nextKoPoint,
  }
}

/**
 * 校验某点是否可合法落子
 */
export function isValidMove(board, r, c, color, koPoint = null) {
  const res = playMove(board, r, c, color, koPoint)
  return res.success
}

/**
 * 获取棋盘所有合法落子点列表
 */
export function getLegalMoves(board, color, koPoint = null) {
  const size = board.length
  const legal = []
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === EMPTY && isValidMove(board, r, c, color, koPoint)) {
        legal.push({ r, c })
      }
    }
  }
  return legal
}

/**
 * 围棋数子法胜负判定 (Area Scoring / 中国规则)
 * 黑贴 3.75 目 (7路/9路) 或 7.5 目 (13路/19路)
 * @param {number[][]} board 棋盘
 * @param {number} komi 贴目数
 * @returns {object} 胜负得分与领地详情
 */
/**
 * 数子前清理死子。
 *
 * 中国规则的数子流程是「先由双方确认死子并移除，再数子+围空」，
 * 不是把盘上所有子都算成活的。原先直接清点全盘，导致：
 *   1 颗被围死的黑子仍给黑记 1 分，3 颗就记 3 分。
 *
 * 判定死子：对方一手能合法提掉它（只剩 1 气，且对方下那口气不是自杀）。
 * 这条判据天然不会误伤活棋——两眼活棋至少 2 气，永远提不掉；
 * 双活（seki）双方共享 2 气，同样不会被判死。
 *
 * 反复迭代：一块死子被清走后，腾出的气可能让原本没气的邻块也变死。
 *
 * @returns {{board:number[][], removedBlack:number, removedWhite:number}}
 */
export function removeDeadStones(board) {
  const size = board.length
  let b = board.map((row) => [...row])
  let removedBlack = 0
  let removedWhite = 0

  // 轮数上限防止逻辑异常时死循环；实际最多 2~3 轮即收敛
  for (let pass = 0; pass < 8; pass++) {
    let removedThisPass = 0
    const seen = new Set()

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (b[r][c] === EMPTY) continue
        const key = `${r},${c}`
        if (seen.has(key)) continue

        const grp = getGroup(b, r, c)
        for (let i = 0; i < grp.stones.length; i++) {
          seen.add(`${grp.stones[i].r},${grp.stones[i].c}`)
        }

        let dead = false
        if (grp.libertyCount === 0) {
          dead = true
        } else if (grp.libertyCount === 1) {
          const lib = grp.liberties[0]
          const opp = grp.color === BLACK ? WHITE : BLACK
          // 数子阶段无劫争顾虑；对方下这口气合法即视为提得掉
          const probe = playMove(b, lib.r, lib.c, opp, null)
          dead = probe.success
        }

        if (dead) {
          for (let i = 0; i < grp.stones.length; i++) {
            const s = grp.stones[i]
            b[s.r][s.c] = EMPTY
          }
          removedThisPass += grp.stones.length
          if (grp.color === BLACK) removedBlack += grp.stones.length
          else removedWhite += grp.stones.length
        }
      }
    }

    if (removedThisPass === 0) break
  }

  return { board: b, removedBlack, removedWhite }
}

/**
 * 围棋数子法胜负判定 (Area Scoring / 中国规则)
 * 黑贴 3.75 目 (7路/9路) 或 7.5 目 (13路/19路)
 *
 * 流程：清理死子 → 清点活子 → 圈定领地 → 合计
 * @param {number[][]} board 棋盘
 * @param {number} komi 贴目数
 * @returns {object} 胜负得分与领地详情
 */
export function calculateScore(board, komi = 3.75) {
  const size = board.length

  // 0. 先清理死子：被对方提得掉的子不能计入己方得分
  const cleanup = removeDeadStones(board)
  const scored = cleanup.board

  let blackStones = 0
  let whiteStones = 0

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (scored[r][c] === BLACK) blackStones++
      else if (scored[r][c] === WHITE) whiteStones++
    }
  }

  // 领地划分
  const visited = new Set()
  // 复制自「已清理死子」的盘面：领地圈定必须基于清理后的棋形，
  // 否则死子周围会被算成其原主的空地，与死子本身重复计分
  const territoryMap = scored.map((row) => [...row]) // 1黑目, 2白目, 0公气
  let blackTerritory = 0
  let whiteTerritory = 0

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (scored[r][c] === EMPTY && !visited.has(`${r},${c}`)) {
        // BFS 搜索该空地连通区域
        const queue = [{ r, c }]
        visited.add(`${r},${c}`)
        const region = [{ r, c }]
        let touchesBlack = false
        let touchesWhite = false

        // 游标而非 shift()：每个空区跑一次 BFS，shift() 的 O(n)
        // 在大空区上会明显拖慢数子
        let head = 0
        while (head < queue.length) {
          const curr = queue[head++]
          const neighbors = getNeighbors(curr.r, curr.c, size)

          for (let i = 0; i < neighbors.length; i++) {
            const { r: nr, c: nc } = neighbors[i]
            const val = scored[nr][nc]
            const k = `${nr},${nc}`

            if (val === BLACK) {
              touchesBlack = true
            } else if (val === WHITE) {
              touchesWhite = true
            } else if (val === EMPTY && !visited.has(k)) {
              visited.add(k)
              region.push({ r: nr, c: nc })
              queue.push({ r: nr, c: nc })
            }
          }
        }

        // 判断领地归属
        let owner = EMPTY
        if (touchesBlack && !touchesWhite) {
          owner = BLACK
          blackTerritory += region.length
        } else if (touchesWhite && !touchesBlack) {
          owner = WHITE
          whiteTerritory += region.length
        }

        region.forEach((p) => {
          territoryMap[p.r][p.c] = owner
        })
      }
    }
  }

  // 中国规则：黑棋总分 = 活子数 + 领地目数
  // 白棋总分 = 活子数 + 领地目数 + 贴子(komi)
  const blackTotal = blackStones + blackTerritory
  const whiteTotal = whiteStones + whiteTerritory + komi
  const diff = Math.abs(blackTotal - whiteTotal)

  let winner = null
  if (blackTotal > whiteTotal) {
    winner = BLACK
  } else if (whiteTotal > blackTotal) {
    winner = WHITE
  } else {
    winner = 0 // 和棋
  }

  return {
    blackStones,
    blackTerritory,
    blackTotal,
    whiteStones,
    whiteTerritory,
    whiteTotal,
    komi,
    winner,
    diff: diff.toFixed(1),
    territoryMap,
    // 数子过程中被清理掉的死子，纯信息字段，供 UI 展示用。
    // 注意：这些子被移除后所在的交叉点已按空地计入 blackTerritory /
    // whiteTerritory / 公气，所以**不可**再叠加到 blackTotal / whiteTotal 上，
    // 恒等式应为：
    //   blackStones + whiteStones + blackTerritory + whiteTerritory + 公气 = size²
    removedBlack: cleanup.removedBlack,
    removedWhite: cleanup.removedWhite,
  }
}

/**
 * 格式化坐标文字 (如 (4, 4) -> "E5")
 */
export function formatCoord(size, r, c) {
  const colLetter = COL_LETTERS[c] || String.fromCharCode(65 + c)
  const rowNum = size - r
  return `${colLetter}${rowNum}`
}
