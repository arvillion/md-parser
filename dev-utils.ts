import { BlockParser } from "./BlockParser";
import { NodeType, BlockNode } from "./types";
import { parseInlines } from "./InlineParser"
import { DoublyLinkedList } from "./DoublyLinkedList";


function parse(raw: string) {
  const bp = new BlockParser(raw)
  const blocks: BlockNode[] = []

  let block = bp.nextBlock()

  while (block.type !== NodeType.CONTAINER_EXIT) {
    blocks.push(block)
    block = bp.nextBlock() 
  }

  const refMap = bp.dumpRef()

  const queue = [...blocks]

  while (queue.length) {
    let top = queue.shift() as BlockNode
    if ( top.type === NodeType.ORDERED_LIST
      || top.type === NodeType.UNORDERED_LIST
      || top.type === NodeType.LIST_ITEM
      || top.type === NodeType.BLOCKQUOTE ){
      let it = top.children.front()
      while (it !== top.children._tail) {
        queue.push(it.item)
      }
    } else if (
      top.type === NodeType.ATX_HEADING ||
      top.type === NodeType.SETEXT_HEADING ||
      top.type === NodeType.PARAGRAPH
    ) {
      parseInlines(top.raw, refMap, top.children)
    }
  }

  const list = new DoublyLinkedList<BlockNode>
  blocks.forEach(b => list.pushBack(b))
  return list
}

// function printAST(blocks: BlockNode[]) {


//   const dfs = () => {

//   }
//   const { type } = nd
//   let typeName = NodeType[type]

//   const leadingAttrs = ['raw']
//   const ignoredAttrs = ['type', 'children']

//   const filteredAttrs = Object.keys(nd).filter(v => !ignoredAttrs.includes(v) && !leadingAttrs.includes(v))
//   // @ts-ignore
//   const info = leadingAttrs.filter(v => v in nd).concat(filteredAttrs).map(v => `${v}=${JSON.stringify(nd[v])}`).join(' | ')

//   console.log(`${'  '.repeat(depth)}[${typeName}] ${info}`)

//   if (type === NodeType.PARAGRAPH) {
//     nd.children = parseInlines(nd.raw, )
//   }

//   if (n) {
//     let nod: DoublyLinkedListItem<Node> | null = children.front()
//     while (nod && nod !== children._tail) {
//       printNode(nod.item, depth + 1)
//       nod = nod.next
//     }
//   }
// }