import { DoublyLinkedListItem } from "./DoublyLinkedList"
import { Node } from "./Node"

export type DelimiterType = '![' | '[' | '*' | '_' 

export interface DelimiterStackItem {
  type: DelimiterType
  nodePtr: DoublyLinkedListItem<Node>
  isActive?: boolean
  canOpen?: boolean // potential opener
  canClose?: boolean // potential closer
}

