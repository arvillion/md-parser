import { DoublyLinkedListItem } from "./doublyLinkedList"
import { Node } from "./Node"

export type DelimiterType = '![' | '[' | '*' | '_' 

export interface DelimiterStackItem extends DoublyLinkedListItem {
  type: DelimiterType
  node: Node
  isActive?: boolean
  canOpen?: boolean // potential opener
  canClose?: boolean // potential closer
}

