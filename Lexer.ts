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

  parseBlockquote(depth: number): {
    children: DoublyLinkedList<Node>,
    depthBackTo: number 
  } {
    const { _raw: raw } = this
    const list = new DoublyLinkedList<Node>()
    const blockquotePattern = /(> ?)?(.*(?:\n|$))/y

    while (this._idx < raw.length) {
      const blockquotePatternResult = blockquotePattern.exec(raw)
      if (blockquotePatternResult) {
        const iraw = blockquotePatternResult[2]

        this._idx += blockquotePattern[1].length

        if (iraw.startsWith('>')) {  
          const { children, depthBackTo } = this.parseBlockquote(depth + 1)
          list.append({
            type: NodeType.BLOCKQUOTE,
            children,
          })
          if (depthBackTo < depth) {
            return {
              children: list,
              depthBackTo
            }
          }
        } else {

          // const maxMarkerNum = depth + 1
          let rraw = blockquotePatternResult[2]
          this._idx = blockquotePattern.lastIndex
          const lineBeginIdxMap = new Map<number, number>

          const arrowsPattern = /((?:> ?)*)(.*(?:\n|$))/y
          const arrowNumStack = [depth + 1]

          const sameArrowNumBefore: number[] = []

          while (this._idx < raw.length) {
            arrowsPattern.lastIndex = this._idx
            const arrowsPatternResult = arrowsPattern.exec(raw)
            if (arrowsPatternResult) {
              const arrowNum = arrowsPatternResult[1].replace(/ /g, '').length

              lineBeginIdxMap.set(rraw.length, this._idx)
              this._idx = arrowsPattern.lastIndex

              const minArrowNum = arrowNumStack[arrowNumStack.length - 1]
              if (arrowNum === minArrowNum) {
                rraw += arrowsPatternResult[2]
              } else if (arrowNum < minArrowNum) {
                arrowNumStack.push(arrowNum)
                sameArrowNumBefore.push(rraw.length)
                rraw += arrowsPatternResult[2]
              } else {
                break
              }
            } else {
              throw new Error('should not go here')
            }
          }

          lineBeginIdxMap.set(rraw.length, this._idx)
          sameArrowNumBefore.push(rraw.length)

          let sidx = sameArrowNumBefore.length - 1
          const firstSameArrowNumBefore = sameArrowNumBefore[0]
          let shouldReturn = false

          const ilexer = new Lexer(rraw)
          while (true) {
            const oldIdx = ilexer._idx
            if (ilexer._idx < firstSameArrowNumBefore) {
              let block = ilexer.nextBlock()
              if (!block) break
              if (ilexer._idx <= firstSameArrowNumBefore) {
                list.append(block)
              } else {
                if (block.type === NodeType.PARAGRAPH) {
                  list.append(block)
                  shouldReturn = true
                } else {
                  // rollback
                  while (sidx > 0 && sameArrowNumBefore[sidx] >= ilexer._idx) {
                    sidx--
                  }
                  ilexer._idx = oldIdx
                  ilexer._raw = ilexer._raw.slice(0, sameArrowNumBefore[sidx])

                  // @ts-ignore
                  this._idx = lineBeginIdxMap.get(sidx)

                  shouldReturn = true
                }
              }
            } else {
              break
            }
          }

          if (shouldReturn) {
            const arrowsBeginPattern = /(?:> ?)*/y
            arrowsBeginPattern.lastIndex = this._idx
            const arrowsBeginPatternResult = arrowsBeginPattern.exec(raw)
            if (arrowsBeginPatternResult) {
              const arrowNum =  arrowsBeginPatternResult[0].replace(/ /g, '').length
              return {
                children: list,
                depthBackTo: arrowNum - 1
              }
            } else {
              throw new Error('should not go here')
            }
            
          }
        }
      }
    }
    return {
      children: list,
      depthBackTo: depth - 1
    }
  }
  
}
