import { Lexer } from "./Lexer";
import { NodeType } from "./Node";

const content = `    Foo
    ---

    Foo
---`

const lexer = new Lexer(content)

const blocks: any[] = []

let block = lexer.nextBlock()

while (block) {
  blocks.push(block)
  block = lexer.nextBlock()
}
console.log(NodeType)
for (let b of blocks) {
  console.log(b)
}

