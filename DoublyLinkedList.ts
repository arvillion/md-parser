
type NullItem = {}

export interface DoublyLinkedListItem<T> {
  next: DoublyLinkedListItem<T>
  last: DoublyLinkedListItem<T>
  item: T
}

export class DoublyLinkedList<T> {
  _head: DoublyLinkedListItem<T> // dummy head
  _tail: DoublyLinkedListItem<T> // dummy tail

  constructor() {
    // @ts-ignore
    this._head = { next: null, last: null }
    // @ts-ignore
    this._tail = { next: null, last: null }
    this._head.next = this._tail
    this._tail.last = this._head
  }

  empty() {
    return this._head.next == this._tail
  }

  pushBack(item: T): DoublyLinkedListItem<T> {
    const itemBeforeTail = this._tail.last
    const newLinkedListItem: DoublyLinkedListItem<T> = {
      item,
      last: itemBeforeTail,
      next: this._tail
    }
    itemBeforeTail.next = newLinkedListItem
    this._tail.last = newLinkedListItem
    return newLinkedListItem
  }

  popFront(): T | null {
    if (this.empty()) return null
    const el = this._head.next
    removeItem(el)
    return el.item
  }

  front(): DoublyLinkedListItem<T> {
    return this._head.next
  }

  back(): DoublyLinkedListItem<T> {
    return this._tail.last
  }

  removeItems(itemStart: DoublyLinkedListItem<T>, itemEnd: DoublyLinkedListItem<T>) {
    const itemBefore = itemStart.last
    const itemAfter = itemEnd
    itemBefore.next = itemAfter
    itemAfter.last = itemBefore
  }
  
  detach(itemStart: DoublyLinkedListItem<T>, itemEnd: DoublyLinkedListItem<T>) {
    const list = new DoublyLinkedList<T>()
    if (itemStart === itemEnd) return list

    list._head.next = itemStart
    list._tail.last = itemEnd.last
  
    const realEnd = itemEnd.last
  
    this.removeItems(itemStart, itemEnd)
    itemStart.last = list._head
    realEnd.next = list._tail
    return list
  }
}



export function removeItem<T>(item: DoublyLinkedListItem<T> | null) {
  if (!item) return
  const itemBefore = item.last
  const itemAfter = item.next
  itemBefore.next = itemAfter
  itemAfter.last = itemBefore
  // @ts-ignore
  item.last = item.next = null
}

export function insertAfter<T>(pos: DoublyLinkedListItem<T>, item: T): DoublyLinkedListItem<T> {
  const itemAfter = pos.next
  const itemNew = {
    item,
    last: pos,
    next: itemAfter
  }
  pos.next = itemNew
  itemAfter.last = itemNew
  return itemNew
}





// export function detachBack<T>(item: DoublyLinkedListItem<T>) {
//   const itemAfter = item.next
//   item.next = null
//   if (!itemAfter) return
//   itemAfter.last = null
// }

// export function detach

