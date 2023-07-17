
type NullItem = {}

export interface DoublyLinkedListItem<T> {
  next: DoublyLinkedListItem<T> | null
  last: DoublyLinkedListItem<T> | null,
  item: T
}

export class DoublyLinkedList<T> {
  _head: DoublyLinkedListItem<T> // dummy head
  _tail: DoublyLinkedListItem<T> // dummy tail

  constructor() {
    // @ts-ignore
    this._head = {
      next: null,
      last: null,
    }
    // @ts-ignore
    this._tail = {
      next: null,
      last: null,
    }
    this._head.next = this._tail
    this._tail.last = this._head
  }

  isEmpty() {
    return this._head.next == this._tail
  }

  append(item: T) {
    const itemBeforeTail = this._tail.last
    const newLinkedListItem = {
      item,
      last: itemBeforeTail,
      next: this._tail
    }
    itemBeforeTail!.next = newLinkedListItem
    this._tail.last = newLinkedListItem
  }

  head(): DoublyLinkedListItem<T> | null {
    return this._head.next == this._tail ? null : this._head.next
  }

  tail(): DoublyLinkedListItem<T> | null {
    return this._head.next == this._tail ? null : this._tail.last
  }
}

export function removeItem<T>(item: DoublyLinkedListItem<T>) {
  const itemBefore = item.last
  const itemAfter = item.next
  itemBefore!.next = itemAfter
  itemAfter!.last = itemBefore
  item.last = null
  item.next = null
}

