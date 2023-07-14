export enum NodeType {
  TEXT,
  SOFT_LINE_BREAK
}

export interface Node {
  type: NodeType,
  raw: string,
  children: Node[] | null
}