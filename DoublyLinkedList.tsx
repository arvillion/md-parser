export interface DoublyLinkedListItem {
  next: DoublyLinkedListItem | null
  last: DoublyLinkedListItem | null
}

export class DoublyLinkedList<T extends DoublyLinkedListItem> {
  _head: DoublyLinkedListItem // dummy head
  _tail: DoublyLinkedListItem // dummy tail
  constructor() {
    this._head = {
      next: null,
      last: null
    }
    this._tail = {
      next: null,
      last: null
    }
    this._head.next = this._tail
    this._tail.last = this._head
  }

  isEmpty() {
    return this._head.next == this._tail
  }

  append(newItem: T) {
    const itemBeforeTail = this._tail.last
    newItem.last = itemBeforeTail
    newItem.next = this._tail
    itemBeforeTail!.next = newItem
    this._tail.last = newItem
  }

  head() {
    return this._head.next == this._tail ? null : this._head.next
  }

  tail() {
    return this._head.next == this._tail ? null : this._tail.last
  }
}

export function removeItem<T extends DoublyLinkedListItem>(item: T) {
  const itemBefore = item.last
  const itemAfter = item.next
  itemBefore!.next = itemAfter
  itemAfter!.last = itemBefore
  item.last = null
  item.next = null
}

