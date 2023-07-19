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


  THEMATIC_BREAK,

  // atx headings
  ATX_HEADING_1,
  ATX_HEADING_2,
  ATX_HEADING_3,
  ATX_HEADING_4,
  ATX_HEADING_5,
  ATX_HEADING_6,

  CODE_FENCE_BLOCK,
  
  BLOCKQUOTE,

  PARAGRAPH

  UNKNOWN,
}

export const linkTypes = [
  NodeType.INLINE_LINK, 
  NodeType.FULL_REF_LINK,
  NodeType.COLLAPSED_REF_LINK,
  NodeType.SHORTCUT_REF_LINK,
]

export const atxTypes = [
  NodeType.ATX_HEADING_1,
  NodeType.ATX_HEADING_2,
  NodeType.ATX_HEADING_3,
  NodeType.ATX_HEADING_4,
  NodeType.ATX_HEADING_5,
  NodeType.ATX_HEADING_6,
]

export interface Node {
  type: NodeType,
  raw?: string,
  children: DoublyLinkedList<Node> | null
}