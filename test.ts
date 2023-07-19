import { Lexer } from "./Lexer";
import { NodeType } from "./Node";

const content = `    chunk1

    chunk2



      chunk3`

const lexer = new Lexer(content)

console.log(NodeType)

const result1 = lexer.nextBlock()
const result2 = lexer.nextBlock()

// @ts-ignore
// result1.type = NodeType[result1.type]
// @ts-ignore

// result2.type = NodeType[result2.type]


console.log(result1, result2)
