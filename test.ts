import { Lexer } from "./Lexer";
import { NodeType } from "./Node";
console.log(NodeType.CODE_FENCE_BLOCK)
const lexer = new Lexer(`\`\`\`
\`\`\` aaa
\`\`\``)

console.log(lexer.nextBlock())
