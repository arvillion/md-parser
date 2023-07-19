import { Lexer } from "./Lexer";
import { NodeType } from "./Node";

const content = `Foo *bar*
=========

Fooa *bar*
---------`

const lexer = new Lexer(content)

const blocks: any[] = []

let block = lexer.nextBlock()

while (block) {
  blocks.push(block)
  block = lexer.nextBlock()
}

for (let b of blocks) {
  console.log(b)
}

