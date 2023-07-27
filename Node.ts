import { DoublyLinkedList } from "./DoublyLinkedList"



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

  // setext headings
  SETEXT_H1,
  SETEXT_H2,

  CODE_FENCE_BLOCK,
  IDENTED_CODE_BLOCK,
  
  BLOCKQUOTE,

  ORDERED_LIST,
  UNORDERED_LIST,
  LIST_ITEM,

  PARAGRAPH,
  POTENTIAL_PARAGRAPH,
  PARAGRAPH_CONTINUATION,

  CONTAINER_EXIT,

  BLANK_LINE,

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

export type UnorderedListItemMarker = '-' | '+' | '*'
export type OrderedListItemMarker = | '.' | ')' 

export type ListItemMarker =  UnorderedListItemMarker | OrderedListItemMarker

export interface ListItem {
  type: NodeType.LIST_ITEM
  children: DoublyLinkedList<Node>
  loose: boolean
  marker: ListItemMarker
  raw?: string
}

export interface UnorderedList {
  type: NodeType.UNORDERED_LIST
  loose: boolean
  raw?: string
  children: DoublyLinkedList<Node>
  marker: UnorderedListItemMarker
}

export interface OrderedList {
  type: NodeType.ORDERED_LIST
  loose: boolean
  raw?: string
  children: DoublyLinkedList<Node>
  startNum: string,
  marker: OrderedListItemMarker
}

export interface Blockquote {
  type: NodeType.BLOCKQUOTE,
  children: DoublyLinkedList<Node>,
  raw?: string
}

export type List = UnorderedList | OrderedList

interface LegacyNode {
  type: NodeType,
  raw?: string,
  children?: DoublyLinkedList<Node>
}

export type Node = LegacyNode | ListItem | List | Blockquote

