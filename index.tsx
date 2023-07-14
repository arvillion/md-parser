
import { Node } from "./Node"
import { DoublyLinkedList } from "./doublyLinkedList"
import { DelimiterStackItem } from "./DelimiterStack"
const markdownRaw: string = "*(**foo**)*"
import { NodeType } from "./Node"
import { getEmphasisDelimiterEffect } from "./utils"

const nodeList: Node[] = []

let rawCopy = markdownRaw
let textBuffer = ""

const delimiterStack = new DoublyLinkedList<DelimiterStackItem>


const flushTextBuffer = () => {
  if (textBuffer) {
    nodeList.push({
      type: NodeType.TEXT,
      raw: textBuffer,
      children: null
    })
    textBuffer = ""
  }
}

let charBefore: string | null = null

while (rawCopy.length) {
//   let delimiterRunLength = 0

  const currentChar = rawCopy.charAt(0)
  let sliceLength = 0

  if (charBefore !== '\\') {
    if (currentChar === '*' || currentChar === '_') {
      let delimiterRunLength = 1
      while (delimiterRunLength < rawCopy.length && rawCopy.charAt(delimiterRunLength) === currentChar) {
        delimiterRunLength++
      }
      sliceLength = delimiterRunLength
      
      const charAfter = delimiterRunLength < rawCopy.length ? rawCopy.charAt(delimiterRunLength) : null
      const { canOpen, canClose } = getEmphasisDelimiterEffect(currentChar, charBefore, charAfter)

      if (!(canOpen || canClose)) {
        // treat as normal text
      } else {
        flushTextBuffer()
        const node: Node = {
          type: NodeType.TEXT,
          raw: currentChar,
          children: null
        }
        nodeList.push(node)
        delimiterStack.append({
          type: currentChar,
          node,
          isActive: true,
          canOpen,
          canClose,
          next: null,
          last: null
        })
      }
    } else if (currentChar === '[') {
      if (charBefore === '!') {
        flushTextBuffer()
        const node: Node = {
          type: NodeType.TEXT,
          raw: currentChar,
          children: null
        }
        nodeList.push(node)
        delimiterStack.append({
          type: currentChar,
          node,
          isActive: true,
          canOpen,
          canClose,
          next: null,
          last: null
        })
      }
    
    } else if (currentChar === ']') {

    } else {

    }
  }
//   if (shouldCheckDelimiterRun) {
//     while (delimiterRunLength < rawCopy.length) {
//       const currentChar = rawCopy.charAt(delimiterRunLength)
//       if (currentChar in ['*', '_'] && (delimiterRunLength || currentChar === char)) {
//         delimiterRunLength++
//       } else {
//         break
//       }
//     }
//   }

//   if (delimiterRunLength) {
//     // process sequence of * and _
//     flushTextBuffer()
//     nodeList.push({
//       type: T_TEXT_NODE,
//       text: char.repeat(delimiterRunLength)
//     })
//     sliceLength = delimiterRunLength
//   } else if (char === '[') {
//     if (lastCharIsExclamation) {
//       // process ![
//       textBuffer = textBuffer.slice(0, -1)
//       flushTextBuffer()
//       nodeList.push({
//         type: T_TEXT_NODE,
//         text: '!['
//       })
//     } else {
//       // process [
//       flushTextBuffer()
//       nodeList.push({
//         type: T_TEXT_NODE,
//         text: char
//       })
//     }
//     sliceLength = 1
//   } else if () {

//   } else {
//     sliceLength = 1
//     textBuffer += char
//   }
  
  lastChar = rawCopy.charAt(sliceLength - 1)
  rawCopy = rawCopy.slice(sliceLength)

  if (lastChar === )
  lastCharIsBackslash = lastChar === '\\' ? true : false;
  lastCharIsExclamation = lastChar === '!' ? true : false;
}
