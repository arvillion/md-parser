import { BlockParser } from "./BlockParser";
import { NodeType, BlockNode, Node } from "./types";
import { parseInlines } from "./InlineParser"
import { DoublyLinkedList } from "./DoublyLinkedList";


export function parse(bp: BlockParser) {
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
  return blocks
}

export function printAST(blocks: BlockNode[]) {

  const leadingAttrs = ['raw']
  const ignoredAttrs = ['type', 'children']
  const tabsize = 2
  

  const printNode = (nd: Node, depth: number) => {
    const { type } = nd
    const typeName = NodeType[type]

    const filteredAttrs = [
      ...leadingAttrs.filter(v => v in nd),
      ...Object.keys(nd).filter(v => !ignoredAttrs.includes(v) && !leadingAttrs.includes(v))
    ]
    //@ts-ignore
    const info = filteredAttrs.map(v => `${v}=${JSON.stringify(nd[v])}`).join(' | ')
    process.stdout.write(' '.repeat(tabsize * depth))
    console.log(`[${typeName}] ${info}`)
  }
  const dfs = (nd: Node, depth: number) => {
    printNode(nd, depth)
    // @ts-ignore
    if (nd.children) {
      //@ts-ignore
      const c: DoublyLinkedList<Node> = nd.children 
      let it = c.front()
      while (it !== c._tail) {
        dfs(it.item, depth + 1)
        it = it.next
      }
    }
  }

  blocks.forEach(b => dfs(b, 0))

}