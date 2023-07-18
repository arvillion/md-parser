import { DoublyLinkedList } from "./doublyLinkedList"
import { atxTypes, Node, NodeType } from "./Node"

export class Lexer {
  _raw: string
  _blocks: DoublyLinkedList<Node>
  _idx: number

  constructor(raw: string) {
    this._idx = 0
    this._raw = raw
    this._blocks = new DoublyLinkedList()
  }

  nextBlock(): Node | null {
    const { _raw: raw } = this
    while (this._idx < raw.length && raw.charAt(this._idx) === ' ') this._idx++
    const indentationNum = this._idx
    if (this._idx >= raw.length) {
      // TODO
      return null
    }
    if (indentationNum < 3) {
      const firstChar = raw.charAt(this._idx)

      // thematic break
      if (['_', '*', '-'].includes(firstChar)) {
        
        const thematicBreakPattern = new RegExp(`(?:\\${firstChar}[\t ]*){3,}(?:\n|$)`, 'y')

        thematicBreakPattern.lastIndex = this._idx
        if (thematicBreakPattern.test(raw)) {
          this._idx = thematicBreakPattern.lastIndex + 1
          const traw = raw.slice(this._idx, thematicBreakPattern.lastIndex)
          return {
            type: NodeType.THEMATIC_BREAK,
            raw: traw,
            children: null
          } 
        }
      }

      // atx heading
      const atxHeadingPattern = /(#{1,6})[ \t$]+(.*?)(?:[ \t]+#+[ \t]*)?$/y
      atxHeadingPattern.lastIndex = this._idx
      const atxHeadingPatternResult = atxHeadingPattern.exec(raw)
      if (atxHeadingPatternResult) {
        const type = atxTypes[(atxHeadingPatternResult[1].length - 1)]
        const contentRaw = atxHeadingPatternResult[2].replace(/^[\t ]|[\t g]$/g, '')
        const araw = raw.slice(this._idx, atxHeadingPattern.lastIndex)
        this._idx = atxHeadingPattern.lastIndex + 1
        // console.log(contentRaw)
        return {
          type,
          raw: araw,
          children: null 
        }
      }

      // fenced code blocks
      const backtickLeadingFencePattern = /(`{3,})[ \t]*([^`]*?)[ \t]*(?:\n|$)/y
      const tildeLeadingFencePattern = /(~{3,})[ \t]*(.*?)[ \t]*(\n|$)/y
      if (firstChar === '~' || firstChar === '`') {
        const patternResult = firstChar === '~' ? tildeLeadingFencePattern.exec(raw) : backtickLeadingFencePattern.exec(raw)
        const lastIndex = firstChar === '~' ? tildeLeadingFencePattern.lastIndex : backtickLeadingFencePattern.lastIndex
        if (patternResult) {
          const leadingFence = patternResult[1]
          const infoStr = patternResult[2]
          const startIdx = this._idx
          this._idx = lastIndex

          const closingFencePattern = new RegExp(`^ {0,3}${firstChar}{${leadingFence.length},}[\t ]*$`, 'gm')
          closingFencePattern.lastIndex = lastIndex + 1
          
          const closingFencePatternResult = closingFencePattern.exec(raw)
          const endIdx = closingFencePattern ? closingFencePattern.lastIndex : raw.length
          const craw = raw.slice(startIdx, endIdx)

          const codeRaw = closingFencePatternResult ? raw.slice(lastIndex, closingFencePatternResult.index) : raw.slice(lastIndex)
          // console.log(codeRaw)
          // console.log(infoStr)
          // TODO: identation
          return {
            type: NodeType.CODE_FENCE_BLOCK,
            raw: craw,
            children: null
          }
        }
      }

      // blockquotes
      if (firstChar === '>') {
        const { raw, children } = parseBlockquote(0)
        return {
          type: NodeType.BLOCKQUOTE,
          raw,
          children
        }
      }

      // paragraph
      i

    } else {
  
    }
    return {
      type: NodeType.UNKNOWN,
      raw: '',
      children: null
    }
  }

  function parseBlockquote(depth: number): {
    braw: string,
    children: DoublyLinkedList<Node>,
    depthBackTo: number 
  } {
    const { _raw: raw } = this._raw
    const list = new DoublyLinkedList()
    const blockquotePattern = /(> )?(.*(?:\n|$))/y

    while (this._idx < raw.length) {
      const blockquotePatternResult = blockquotePattern.exec(raw)
      if (blockquotePatternResult) {
        const iraw = blockquotePatternResult[2]

        // TODO: _idx confirm
        this._idx += blockquotePattern[1].length

        if (iraw.startsWith('>')) {  
          const { braw, children, depthBackTo } = parseBlockquote(depth + 1)
          const oldIdx = this._idx
          list.append({
            type: NodeType.BLOCKQUOTE,
            children,
            raw: braw
          })
          if (depthBackTo < depth) {
            // TODO: verify whether braw is correct
            return {
              braw: raw.slice(oldIdx, this._idx),
              children: list,
              depthBackTo
            }
          }
        } else {

          const maxMarkerNum = depth + 1
          let rraw = blockquotePatternResult[2]
          this._idx = blockquotePattern.lastIndex

          const arrowsPattern = /((?:> )*)(.*(?:\n|$))/y
          const sameArrowNumBefore: number[] = []

          while (this._idx < raw.length) {
            arrowsPattern.lastIndex = this._idx
            const arrowsPatternResult = arrowsPattern.exec(raw)
            if (arrowsPatternResult) {
              const arrowNum = arrowsPatternResult[1].trim().split(' ').length
              if (arrowNum === maxMarkerNum) {
                rraw += arrowsPatternResult[2]
              } else if (arrowNum < maxMarkerNum) {
                sameArrowNumBefore.push(rraw.length + 1)
                rraw += arrowsPatternResult[2]
              } else {
                break
              }
            } else {
              // TODO
              throw new Error('should not go here')
            }
          }

          const ilexer = new Lexer(rraw)
          let oldIdx = 0
          let block = ilexer.nextBlock()

          let depthBackTo = maxMarkerNum

          while (block) {
            if (block.type === NodeType.PARAGRAPH) {
              list.append(block)
              while (sameArrowNumBefore.length && sameArrowNumBefore[0] <= ilexer._idx) {
                sameArrowNumBefore.shift()
              }
            } else {
              if (!sameArrowNumBefore.length || ilexer._idx <= sameArrowNumBefore[0]) {
                list.append(block)
              } else {
                // rollback
                ilexer._idx = oldIdx
                ilexer._raw = ilexer._raw.slice(oldIdx, sameArrowNumBefore[0])
                this._idx = sameArrowNumBefore[0]
              }
            }
            oldIdx = ilexer._idx
            block = ilexer.nextBlock()
          }

          const arrowsBeginPattern = /(?:> )*/y
          arrowsBeginPattern.lastIndex = this._idx

          const arrowsBeginPatternResult = arrowsBeginPattern.exec(raw)
          

          if (shouldReturn) {
            return {
              braw:
              children: list,
              depthBackTo
            }
          }
          

        }
      }
    }
    
  }
}
