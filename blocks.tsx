import { NodeType, Node } from "./Node"
import { DoublyLinkedList } from "./DoublyLinkedList"

const nodeList = new DoublyLinkedList<Node>

function parseBlocks(raw: string ) {

  let idx = 0
  while (idx < raw.length) {
    while (idx < raw.length && raw.charAt(idx) === ' ') idx++
    const indentationNum = idx
    if (indentationNum < 3) {
      const firstChar = raw.charAt(idx)

      // thematic break
      if (['_', '*', '-'].includes(firstChar)) {
        
        const thematicBreakPattern = new RegExp(`/^(?:\\${firstChar}[\t ]*){3,}$/gm`)
        thematicBreakPattern.lastIndex = idx
        if (thematicBreakPattern.test(raw)) {
          nodeList.append({
            type: NodeType.THEMATIC_BREAK,
            raw: raw.slice(idx, thematicBreakPattern.lastIndex),
            children: null
          })
          idx = thematicBreakPattern.lastIndex + 1
          continue     
        }
      }

      // atx heading

      // between an opening sequence of 1–6 unescaped # characters and an optional closing sequence of any number of unescaped # characters. 
      // The opening sequence of # characters must be followed by spaces or tabs, or by the end of line. 
      // The optional closing sequence of #s must be preceded by spaces or tabs and may be followed by spaces or tabs only. 
      // The opening # character may be preceded by up to three spaces of indentation. 
      // The raw contents of the heading are stripped of leading and trailing space or tabs before being parsed as inline content. 
      // The heading level is equal to the number of # characters in the opening sequence.
      const atxHeadingPattern = /^(#{1,6})[ \t$]+(.*?)(?:[ \t]+#+[ \t]*)?$/gm
      atxHeadingPattern.lastIndex = idx
      const atxHeadingPatternResult = atxHeadingPattern.exec(raw)


    } else {
  
    }
  }
  



  raw = raw.slice(idx)
  
}