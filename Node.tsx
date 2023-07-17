import { DoublyLinkedList } from "./doublyLinkedList"

export enum NodeType {
  TEXT,
  SOFT_LINE_BREAK,

  INLINE_LINK,
  FULL_REF_LINK,
  COLLAPSED_REF_LINK,
  SHORTCUT_REF_LINK,

  INLINE_IMAGE,
  FULL_REF_IMAGE,
  COLLAPSED_REF_IMAGE,
  SHORTCUT_REF_IMAGE,

  UNKNOWN
}

export const linkTypes = [
  NodeType.INLINE_LINK, 
  NodeType.FULL_REF_LINK,
  NodeType.COLLAPSED_REF_LINK,
  NodeType.SHORTCUT_REF_LINK,
]

export interface Node {
  type: NodeType,
  raw: string,
  children: DoublyLinkedList<Node> | null
}