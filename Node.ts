import { DoublyLinkedList } from "./DoublyLinkedList"

type ChildrenContainer<T> = DoublyLinkedList<T>
export { DoublyLinkedList as ChildrenContainer }

export enum NodeType {
  
  SOFT_LINE_BREAK,

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
  
  HTML_BLOCK,

  CONTAINER_EXIT,

  BLANK_LINE,

  UNKNOWN,


  // inline nodes
  CODE_SPAN,
  EMPHASIS,
  STRONG_EMPHASIS,
  LINK,
  IMAGE,
  AUTO_LINK,
  HTML_INLINE,

  INLINE_LINK,
  FULL_REF_LINK,
  COLLAPSED_REF_LINK,
  SHORTCUT_REF_LINK,

  INLINE_IMAGE,
  FULL_REF_IMAGE,
  COLLAPSED_REF_IMAGE,
  SHORTCUT_REF_IMAGE,

  TEXT,
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
  children: ChildrenContainer<BlockNode>
  loose: boolean
  marker: ListItemMarker
  raw?: string
}

export interface UnorderedList {
  type: NodeType.UNORDERED_LIST
  loose: boolean
  raw?: string
  children: ChildrenContainer<BlockNode>
  marker: UnorderedListItemMarker
}

export interface OrderedList {
  type: NodeType.ORDERED_LIST
  loose: boolean
  raw?: string
  children: ChildrenContainer<BlockNode>
  startNum: string,
  marker: OrderedListItemMarker
}

export interface Blockquote {
  type: NodeType.BLOCKQUOTE,
  children: ChildrenContainer<BlockNode>,
  raw?: string
}

export interface HtmlBlock {
  type: NodeType.HTML_BLOCK,
  raw: string
}

export interface Paragraph {
  type: NodeType.PARAGRAPH,
  raw: string,
  children: ChildrenContainer<InlineNode>
}

export interface PontentialParagraph {
  type: NodeType.POTENTIAL_PARAGRAPH,
  raw: string
}

export type List = UnorderedList | OrderedList

interface LegacyNode {
  type: NodeType,
  raw?: string,
  children?: ChildrenContainer<BlockNode>
}

export interface CodeSpan {
  type: NodeType.CODE_SPAN
  raw: string
}

export interface Emphasis {
  type: NodeType.EMPHASIS
  raw?: string
  children: ChildrenContainer<InlineNode>
}

export interface StrongEmphasis {
  type: NodeType.EMPHASIS
  raw?: string
  children: ChildrenContainer<InlineNode>
}

export interface HtmlInline {
  type: NodeType.HTML_INLINE
  raw: string
}

export interface AutoLink {
  type: NodeType.AUTO_LINK
  label: string
  link: string
}

export interface InlineLink {
  type: NodeType.INLINE_LINK
  children: ChildrenContainer<InlineNode>
  dest?: string
  title?: string
}

export interface FullRefLink {
  type: NodeType.FULL_REF_LINK
  children: ChildrenContainer<InlineNode>
  label: string
}

export interface CollapsedRefLink {
  type: NodeType.COLLAPSED_REF_LINK
  label: string
}

export interface ShortcutRefLink {
  type: NodeType.SHORTCUT_REF_LINK
  label: string
}

export type RefLink = FullRefLink | CollapsedRefLink | ShortcutRefLink
export type Link = InlineLink | RefLink

export interface InlineImage {
  type: NodeType.INLINE_IMAGE
  children: ChildrenContainer<InlineNode> // img alt
  dest?: string
  title?: string
}

export interface FullRefImage {
  type: NodeType.FULL_REF_IMAGE
  children: ChildrenContainer<InlineNode> // img alt
  label: string
}

export interface CollapsedRefImage {
  type: NodeType.COLLAPSED_REF_IMAGE
  label: string
}

export interface ShortcutRefImage {
  type: NodeType.SHORTCUT_REF_IMAGE
  label: string
}

export interface Text {
  type: NodeType.TEXT,
  raw: string
}

export type RefImage = FullRefImage | CollapsedRefImage | ShortcutRefImage
export type Image = InlineImage | RefImage

export type InlineNode = CodeSpan | Emphasis | StrongEmphasis | Link | Image | AutoLink | HtmlInline | Text
export type BlockNode = LegacyNode | ListItem | List | Blockquote | Paragraph | PontentialParagraph
export type Node = BlockNode | InlineNode
