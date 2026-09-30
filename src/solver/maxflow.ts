/** Small Dinic max-flow (integer capacities). Used by the teacher-assignment feasibility check. */
export class MaxFlow {
  private readonly n: number
  private head: number[]
  private to: number[] = []
  private cap: number[] = []
  private next: number[] = []
  constructor(n: number) {
    this.n = n
    this.head = new Array(n).fill(-1)
  }
  /** Adds edge u→v with capacity c; returns the edge index (flow = original c − residual cap). */
  addEdge(u: number, v: number, c: number): number {
    const e = this.to.length
    this.to.push(v, u); this.cap.push(c, 0)
    this.next.push(this.head[u], this.head[v])
    this.head[u] = e; this.head[v] = e + 1
    return e
  }
  flowOn(e: number): number { return this.cap[e + 1] }
  run(s: number, t: number): number {
    let flow = 0
    const level = new Int32Array(this.n)
    const it = new Int32Array(this.n)
    const bfs = () => {
      level.fill(-1); level[s] = 0
      const q = [s]
      for (let qi = 0; qi < q.length; qi++) {
        const u = q[qi]
        for (let e = this.head[u]; e >= 0; e = this.next[e]) if (this.cap[e] > 0 && level[this.to[e]] < 0) { level[this.to[e]] = level[u] + 1; q.push(this.to[e]) }
      }
      return level[t] >= 0
    }
    const dfs = (u: number, f: number): number => {
      if (u === t) return f
      for (; it[u] >= 0; it[u] = this.next[it[u]]) {
        const e = it[u], v = this.to[e]
        if (this.cap[e] > 0 && level[v] === level[u] + 1) {
          const d = dfs(v, Math.min(f, this.cap[e]))
          if (d > 0) { this.cap[e] -= d; this.cap[e ^ 1] += d; return d }
        }
      }
      return 0
    }
    while (bfs()) {
      for (let i = 0; i < this.n; i++) it[i] = this.head[i]
      let f: number
      while ((f = dfs(s, Infinity)) > 0) flow += f
    }
    return flow
  }
}
