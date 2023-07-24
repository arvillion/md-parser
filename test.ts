import { DoublyLinkedListItem } from "./DoublyLinkedList";
import { Lexer } from "./Lexer";
import { NodeType, Node } from "./Node";
import * as fs from 'node:fs';

const testDownloadUrl = 'https://spec.commonmark.org/0.30/spec.json'
const filePath = 'spec.json'

let tc: any = null
const caseNo = 242

let raw = `>> aaa
>
>> sss`

main()

function runTestCase(caseNo: number) {
  if (!Array.isArray(tc)) {
    throw new Error('test data does not exists')
  }
  const tcc = tc[caseNo - 1]
  if (!tcc) {
    throw new Error(`test case #${caseNo} does not exist`)
  }
  const raw = tcc.markdown
  console.log(`====== Test case #${caseNo} ======`)
  console.log(`raw: ${JSON.stringify(raw)}`)
  console.log(`html: ${JSON.stringify(tcc.html)}`)
  const lexer = new Lexer(raw)
  const blocks: Node[] = []

  let block: Node = lexer.nextBlock()

  // while (block = lexer.nextBlock()) {
  //   blocks.push(block)
  // }
  // for (let b of blocks) {
  //   printNode(b, 0)
  // }
  while (block.type !== NodeType.CONTAINER_EXIT) {
    printNode(block, 0)
    block = lexer.nextBlock() 
  }
}

function runManualTest(raw: string) {
  console.log(`raw: ${JSON.stringify(raw)}`)
  const lexer = new Lexer(raw)
  const blocks: Node[] = []
  let block: Node = lexer.nextBlock()
  while (block.type !== NodeType.CONTAINER_EXIT) {
    printNode(block, 0)
    block = lexer.nextBlock() 
  }
}

async function main() {
  
  if (!fs.existsSync(filePath)) {
    console.log("Downloading test cases from " + testDownloadUrl)
    tc = await fetch(testDownloadUrl).then((res: { json: () => any; }) => res.json())
    console.log("Downloaded")
    fs.writeFileSync(filePath, JSON.stringify(tc), {
      flag: 'w',
      encoding: 'utf-8'
    })
  } else {
    const content = fs.readFileSync(filePath, {
      encoding: 'utf-8'
    })
    tc = JSON.parse(content)
  }

  try {
    console.log(NodeType)
    if (raw) {
      runManualTest(raw)
    } else {
      runTestCase(caseNo)
    }
  } catch (e) {
    console.error(e)
  }
}

function printNode(nd: Node, depth = 0) {
  let { raw, children, type } = nd
  let typeName = NodeType[type]
  console.log(`${'  '.repeat(depth)}[${typeName}] ${raw ? 'raw: ' + JSON.stringify(raw) : ''}`)
  if (children) {
    let nod: DoublyLinkedListItem<Node> | null = children.head()
    while (nod && nod !== children._tail) {
      printNode(nod.item, depth + 1)
      nod = nod.next
    }
  }
}



