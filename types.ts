import { DoublyLinkedList } from "./DoublyLinkedList"

type ChildrenContainer<T> = DoublyLinkedList<T>
export { DoublyLinkedList as ChildrenContainer }

export enum NodeType {
  THEMATIC_BREAK,

  ATX_HEADING,
  SETEXT_HEADING,

  CODE_FENCE_BLOCK,
  INDENTED_CODE_BLOCK,
  
  BLOCKQUOTE,

  ORDERED_LIST,
  UNORDERED_LIST,
  LIST_ITEM,

  PARAGRAPH,
  POTENTIAL_PARAGRAPH,
  PARAGRAPH_CONTINUATION,

  LINK_REF_DEF,
  
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

  SOFT_LINE_BREAK,
  HARD_LINE_BREAK,
}

export const linkTypes = [
  NodeType.INLINE_LINK, 
  NodeType.FULL_REF_LINK,
  NodeType.COLLAPSED_REF_LINK,
  NodeType.SHORTCUT_REF_LINK,
]

export interface ContainerExit {
  type: NodeType.CONTAINER_EXIT
}

export interface BlankLine {
  type: NodeType.BLANK_LINE
}

export type UnorderedListItemMarker = '-' | '+' | '*'
export type OrderedListItemMarker = | '.' | ')' 

export type ListItemMarker =  
  | UnorderedListItemMarker 
  | OrderedListItemMarker

export interface ListItem {
  type: NodeType.LIST_ITEM
  children: ChildrenContainer<BlockNode>
  loose: boolean
  marker: ListItemMarker
  raw?: string
}

export type SetextHeadingLevel = 1 | 2
export type AtxHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6
export interface SetextHeading {
  type: NodeType.SETEXT_HEADING
  level: SetextHeadingLevel
  raw: string
  children: ChildrenContainer<InlineNode>
}
export interface AtxHeading {
  type: NodeType.ATX_HEADING
  level: AtxHeadingLevel
  raw: string
  children: ChildrenContainer<InlineNode>
}

export interface ThematicBreak {
  type: NodeType.THEMATIC_BREAK
}

export interface UnorderedList {
  type: NodeType.UNORDERED_LIST
  loose: boolean
  raw?: string
  children: ChildrenContainer<ListItem>
  marker: UnorderedListItemMarker
}

export interface OrderedList {
  type: NodeType.ORDERED_LIST
  loose: boolean
  raw?: string
  children: ChildrenContainer<ListItem>
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

export interface FencedCodeBlock {
  type: NodeType.CODE_FENCE_BLOCK
  raw: string
}

export interface IndentedCodeBlock {
  type: NodeType.INDENTED_CODE_BLOCK
  raw: string
}

export interface Paragraph {
  type: NodeType.PARAGRAPH
  raw: string
  children: ChildrenContainer<InlineNode>
}

export interface PontentialParagraph {
  type: NodeType.POTENTIAL_PARAGRAPH
  raw: string
  contentBeginIdx: number
}

export interface ParagraphContinuation {
  type: NodeType.PARAGRAPH_CONTINUATION
  raw: string
}

export interface LinkRefDef {
  type: NodeType.LINK_REF_DEF,
  label: string
  dest: string
  title?: string
}

// inline nodes start from here

export interface CodeSpan {
  type: NodeType.CODE_SPAN
  raw: string
}

export interface Emphasis {
  type: NodeType.EMPHASIS
  children: ChildrenContainer<InlineNode>
}

export interface StrongEmphasis {
  type: NodeType.STRONG_EMPHASIS
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
  children: ChildrenContainer<InlineNode>
  label: string
}

export interface ShortcutRefLink {
  type: NodeType.SHORTCUT_REF_LINK
  children: ChildrenContainer<InlineNode>
  label: string
}

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
  children: ChildrenContainer<InlineNode>
  label: string
}

export interface ShortcutRefImage {
  type: NodeType.SHORTCUT_REF_IMAGE
  children: ChildrenContainer<InlineNode>
  label: string
}

export interface Text {
  type: NodeType.TEXT,
  raw: string
}

export interface SoftLineBreak {
  type: NodeType.SOFT_LINE_BREAK
}

export interface HardLineBreak {
  type: NodeType.HARD_LINE_BREAK
}

export type List = 
  | UnorderedList 
  | OrderedList

export type LinkType = 
  | NodeType.INLINE_LINK 
  | NodeType.FULL_REF_LINK 
  | NodeType.COLLAPSED_REF_LINK 
  | NodeType.SHORTCUT_REF_LINK

export type ImageType = 
  | NodeType.INLINE_IMAGE 
  | NodeType.FULL_REF_IMAGE 
  | NodeType.COLLAPSED_REF_IMAGE 
  | NodeType.SHORTCUT_REF_IMAGE


export type RefImage = 
  | FullRefImage 
  | CollapsedRefImage 
  | ShortcutRefImage

export type Image = 
  | InlineImage 
  | RefImage

export type RefLink = 
  | FullRefLink 
  | CollapsedRefLink 
  | ShortcutRefLink

export type Link = 
  | InlineLink 
  | RefLink

export type InlineNode = 
  | CodeSpan 
  | Emphasis 
  | StrongEmphasis 
  | Link 
  | Image 
  | AutoLink 
  | HtmlInline 
  | Text
  | HardLineBreak
  | SoftLineBreak

export type BlockNode = 
  | ListItem 
  | List 
  | Blockquote 
  | Paragraph 
  | PontentialParagraph
  | ParagraphContinuation
  | ContainerExit
  | BlankLine
  | HtmlBlock
  | FencedCodeBlock
  | IndentedCodeBlock
  | AtxHeading
  | SetextHeading
  | ThematicBreak
  | LinkRefDef

export type Node = 
  | BlockNode 
  | InlineNode

export interface Ref {
  label: string
  dest: string
  title?: string
}

export type RefMap = Record<string, Ref>


