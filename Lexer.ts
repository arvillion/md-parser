import { DoublyLinkedList } from "./DoublyLinkedList"
import { atxTypes, Node, NodeType } from "./Node"

interface CachedBlock {
  nextIdx: number,
  node: Node
}

interface LineInfo {
  identNum: number
  blankLinesBefore: number,
  hasBlankLineBefore: boolean

  invalidContIdx: number
  isPrefixOk: boolean

  lineBeginIdx: number

  rollbackIdx: number
}

const containerExit: Node = {
  type: NodeType.CONTAINER_EXIT
}

export class Lexer {
  _raw: string
  _blocks: DoublyLinkedList<Node>
  _idx: number

  // A line containing no characters, or a line containing only spaces (U+0020) or tabs (U+0009), is called a blank line.
  _blankLinePattern = /[ \t]*(?:\n|$)/y
  _paragraphPattern = /.*(?:\n|$)/y
  _identedCodePattern = /     ?.*(?:\n|$)/y

  _lastBlock: Node | null = null

  _cachedBlocks: CachedBlock[] = []

  constructor(raw: string) {
    this._idx = 0
    this._raw = raw
    this._blocks = new DoublyLinkedList()
  }

  nextBlock(): Node | null {
    let block: Node | null = null
    const { _cachedBlocks: cachedBlocks } = this

    const cache = cachedBlocks.shift()
    if (cache) {
      this._idx = cache.nextIdx
      block = cache.node
    } else {
      block = this._nextBlock([])
    }

    this._lastBlock = block
    return block
  }

  _nextLine(contStack: string[], skipIdentation: boolean = true, skipBlankLines: boolean = true): LineInfo | null {
    // check whether the line prefix conforms the rules of current containers

    const { 
      _raw: raw,
      _blankLinePattern: blankLinePattern
    } = this

    let hasBlankLineBefore = false
    let invalidContIdx = 0
    let isPrefixOk = true
    let blankLinesBefore = 0
    const rollbackIdx = this._idx

    // skip blank lines
    if (skipBlankLines) {
      blankLinePattern.lastIndex = this._idx
      while (this._idx < raw.length && blankLinePattern.test(raw)) {
        this._idx = blankLinePattern.lastIndex
        blankLinesBefore++
        hasBlankLineBefore = true
      }
    }

    if (this._idx >= raw.length) {
      return null
    }

    const lineBeginIdx = this._idx

    // calculate the number of spaces of identation
    const oldIdx = this._idx
    while (this._idx < raw.length && raw.charAt(this._idx) === ' ') {
      this._idx++
    }
    let identNum = this._idx - oldIdx

    if (identNum <= 3) {
      // check container prefix
      if (contStack.length) {
        for (; invalidContIdx < contStack.length; invalidContIdx++) {
          const cont = contStack[invalidContIdx]
          let shouldContinue = true
          if (cont === '>') {
            if (raw.charAt(this._idx) === '>') {
              this._idx++
              if (raw.charAt(this._idx) === ' ') {
                this._idx++
              }
            } else {
              shouldContinue = false
            }
          } else {
            throw new Error(`${cont} container is currently not supported`)
          }

          if (!shouldContinue) {
            isPrefixOk = false
            break
          }
        }
      }

      // re-calculate the number of spaces of identation
      const oldIdx = this._idx
      while (this._idx < raw.length && raw.charAt(this._idx) === ' ') {
        this._idx++
      }
      identNum = this._idx - oldIdx

    } else {
      isPrefixOk = contStack.length ? false : true
    }

    if (!skipIdentation) {
      this._idx -= identNum
    }

    return {
      identNum,
      hasBlankLineBefore,
      blankLinesBefore,

      invalidContIdx,
      isPrefixOk,

      lineBeginIdx,

      rollbackIdx
    }
  }

  _nextBlock(contStack: string[]): Node {
    const { 
      _cachedBlocks: cachedBlocks
    } = this

    const cache = cachedBlocks.shift()
    if (cache) {
      this._idx = cache.nextIdx
      return cache.node
    }

    const lineInfo = this._nextLine(contStack)
    
    if (!lineInfo) {
      return containerExit
    }

    const { identNum, isPrefixOk, invalidContIdx, hasBlankLineBefore, lineBeginIdx } = lineInfo

    let ret: Node | null = null

    const currContStack = isPrefixOk ? contStack : contStack.slice(0, invalidContIdx - 1)

    if (identNum < 4) {
      ret = this.parseAtxHeading() ||
            this.parseFencedCode(currContStack) ||
            this.parseBlockquote(currContStack) ||
            this.parseSetextHeading(lineInfo, currContStack) || 
            this.parseThematicBreak() ||
            this.parseParagraph(lineInfo, currContStack)
    } else {
      if (!hasBlankLineBefore && this._lastBlock?.type === NodeType.POTENTIAL_PARAGRAPH) {
        this._idx -= identNum
        ret = this.parseParagraph(lineInfo, currContStack)
      } else {
        ret = this.parseIdentedCode(lineInfo, currContStack)
      }
    }

    if (isPrefixOk) {
      return ret
    } else {
      if (ret?.type === NodeType.PARAGRAPH_CONTINUATION) {
        return ret
      } else {
        if (ret) {
          const exitNum = contStack.length - invalidContIdx - 1
          for (let i = 0; i < exitNum; i++) {
            cachedBlocks.push({
              node: containerExit,
              nextIdx: this._idx
            })
          }
          cachedBlocks.push({
            node: ret,
            nextIdx: this._idx
          })
        }
        return containerExit
      }
    
    }
  }

  parseAtxHeading(): Node | null {
    const { _raw: raw } = this
    const atxHeadingPattern = /(#{1,6})[ \t$]+(.*?)(?:[ \t]+#+[ \t]*)?(?:$|\n)/y
    atxHeadingPattern.lastIndex = this._idx
    const atxHeadingPatternResult = atxHeadingPattern.exec(raw)
    if (atxHeadingPatternResult) {
      const type = atxTypes[(atxHeadingPatternResult[1].length - 1)]
      const contentRaw = atxHeadingPatternResult[2].replace(/^[\t ]|[\t g]$/g, '')
      const araw = raw.slice(this._idx, atxHeadingPattern.lastIndex)
      this._idx = atxHeadingPattern.lastIndex
      // console.log(contentRaw)
      return {
        type,
        raw: araw,
        // children: null 
      }
    } else {
      return null
    }
  }

  parseSetextHeading(lineInfo: LineInfo, contStack: string[]): Node | null {
    const { hasBlankLineBefore, isPrefixOk } = lineInfo
    const { _raw: raw, _lastBlock: lastBlock } = this

    if (!isPrefixOk || hasBlankLineBefore || lastBlock?.type !== NodeType.POTENTIAL_PARAGRAPH) {
      return null
    }

    const setextHeadingPattern = /([=-])\1*[ \t]*(?:\n|$)/y
    setextHeadingPattern.lastIndex = this._idx
    const patternResult = setextHeadingPattern.exec(raw)
    if (patternResult) {
      if (patternResult[1] === '=') {
        lastBlock.type = NodeType.SETEXT_H1
      } else {
        lastBlock.type = NodeType.SETEXT_H2
      }
      lastBlock.raw += patternResult[0]
      this._idx = setextHeadingPattern.lastIndex
      return this._nextBlock(contStack)
    }
    return null
  }

  parseFencedCode(contStack: string[]): Node | null {
    const { _raw: raw } = this
    const firstChar = raw.charAt(this._idx)
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

        // const closingFencePattern = new RegExp(`^ {0,3}${firstChar}{${leadingFence.length},}[\t ]*$`, 'gm')
        const closingFencePattern = new RegExp(`^${firstChar}{${leadingFence.length},}[\t ]*(?:$|\n)`, 'y')

        let craw = ""
        let l = this._nextLine(contStack, false, false)
        while (l) {
          const { isPrefixOk, identNum, rollbackIdx } = l
          if (!isPrefixOk) {
            this._idx = rollbackIdx
            break
          }

          const contentBeginIdx = this._idx

          closingFencePattern.lastIndex = this._idx
          if (identNum <= 3 && closingFencePattern.test(raw)) {
            break
          }

          l = this._nextLine(contStack)
          craw += raw.slice(contentBeginIdx, this._idx)
        }
        
        // console.log(codeRaw)
        // console.log(infoStr)
        // TODO: identation
        // TODO: _idx
        return {
          type: NodeType.CODE_FENCE_BLOCK,
          raw: craw,
        }
      }
    }
    return null
  }

  parseParagraph(lineInfo: LineInfo, contStack: string[]): Node {
    const { _raw: raw, _lastBlock: lastBlock } = this
    const { hasBlankLineBefore } = lineInfo
    this._paragraphPattern.lastIndex = this._idx
    const result = this._paragraphPattern.exec(raw)
    // @ts-ignore
    const praw = result[0]

    if (!hasBlankLineBefore && lastBlock?.type === NodeType.POTENTIAL_PARAGRAPH) {
      return {
        type: NodeType.PARAGRAPH_CONTINUATION,
        raw: praw,
        // children: null
      }
    }

    const block = {
      type: NodeType.POTENTIAL_PARAGRAPH,
      raw: praw,
      // children: null
    }
    this._lastBlock = block
    this._idx = this._paragraphPattern.lastIndex

    let nextBlk = null
    if (nextBlk = this._nextBlock(contStack))
    while (nextBlk?.type === NodeType.POTENTIAL_PARAGRAPH) {
      block.raw += nextBlk.raw
      nextBlk = this._nextBlock(contStack)
    }

    // if the block is not turned into a setext heading
    if (block.type === NodeType.POTENTIAL_PARAGRAPH) {
      block.type = NodeType.PARAGRAPH
    }

    if (nextBlk) {
      this._cachedBlocks.push({
        node: nextBlk,
        nextIdx: this._idx 
      })
    }

    return block
  }

  parseThematicBreak(): Node | null {
    const { _raw: raw } = this
    const firstChar = raw.charAt(this._idx)
    if (['_', '*', '-'].includes(firstChar)) {
        
      const thematicBreakPattern = new RegExp(`(?:\\${firstChar}[\t ]*){3,}(?:\n|$)`, 'y')

      thematicBreakPattern.lastIndex = this._idx
      if (thematicBreakPattern.test(raw)) {
        this._idx = thematicBreakPattern.lastIndex
        const traw = raw.slice(this._idx, thematicBreakPattern.lastIndex)
        return {
          type: NodeType.THEMATIC_BREAK,
          raw: traw,
        } 
      }
    }
    return null
  }

  parseBlockquote(contStack: string[]): Node | null {
    const { _raw: raw } = this
    const firstChar = raw.charAt(this._idx)

    if (firstChar !== '>') {
      return null
    }

    contStack.push('>')
    const list = new DoublyLinkedList<Node>()
    let block = this._nextBlock(contStack)
    while (block.type !== NodeType.CONTAINER_EXIT) {
      list.append(block)
      block = this._nextBlock(contStack)
    }

    contStack.pop()

    return {
        type: NodeType.BLOCKQUOTE,
        // TODO: raw
        children: list
      }
  }

  parseIdentedCode(lineInfo: LineInfo, contStack: string[]) {
    // idented code block cannot interrupt a paragraph
    const { hasBlankLineBefore, identNum } = lineInfo
    const { _blankLinePattern: blankLinePattern, _raw: raw } = this

    let craw = ""
    
    let lf : LineInfo | null = lineInfo
    this._idx -= identNum
    let backupIdx = this._idx

    // TODO: regex-free optimization
    while (true) {

      let blanks = ""
      let ccraw = ""
      blankLinePattern.lastIndex = this._idx
      while (lf?.isPrefixOk && this._idx < raw.length && blankLinePattern.test(raw)) {
        blanks += '\n'
        this._idx = blankLinePattern.lastIndex
        lf = this._nextLine(contStack, false, false)
      }

      if (!lf) {
        // end of raw
        break
      }

      if (!lf.isPrefixOk) {
        this._idx = backupIdx
        break
      }

      this._identedCodePattern.lastIndex = this._idx

      while (lf?.isPrefixOk && this._identedCodePattern.test(raw)) {
        ccraw += raw.slice(this._idx + 4, this._identedCodePattern.lastIndex)
        this._idx = this._identedCodePattern.lastIndex
        backupIdx = this._idx
        lf = this._nextLine(contStack, false, false)
      }

      if (ccraw) {
        craw = craw + blanks + ccraw
      }

      if (!lf) {
        // end of raw
        break
      }

      if (!lf.isPrefixOk) {
        this._idx = backupIdx
        break
      }

    }
    
    return {
      type: NodeType.IDENTED_CODE_BLOCK,
      raw: craw, // indented code block raw is excluded of leading 4 spaces,
    }
  }

    // const blockquotePattern = /(> ?)(.*(?:\n|$))/y    

    // while (this._idx < raw.length) {
    //   const blockquotePatternResult = blockquotePattern.exec(raw)
    //   if (blockquotePatternResult) {
    //     const iraw = blockquotePatternResult[2]

    //     this._idx += blockquotePatternResult[1].length

    //     if (iraw.startsWith('>')) {  
    //       const { children, depthBackTo } = this.parseBlockquote(depth + 1)
    //       list.append({
    //         type: NodeType.BLOCKQUOTE,
    //         children,
    //       })
    //       if (depthBackTo < depth) {
    //         return {
    //           children: list,
    //           depthBackTo
    //         }
    //       }
    //     } else {

    //       let rraw = blockquotePatternResult[2]
    //       this._idx = blockquotePattern.lastIndex

    //       const arrowsPattern = /((?:> ?)*)(.*(?:\n|$))/y
    //       let arrowNumNow = depth + 1

    //       const sameArrowNumBefore: number[] = []
    //       const lineBeginIdxMap = new Map<number, number>()

    //       while (this._idx < raw.length) {
    //         arrowsPattern.lastIndex = this._idx
    //         lineBeginIdxMap.set(rraw.length, this._idx)
    //         const arrowsPatternResult = arrowsPattern.exec(raw)
    //         this._idx = arrowsPattern.lastIndex


    //         if (arrowsPatternResult) {
    //           const arrowNum = arrowsPatternResult[1].replace(/ /g, '').length

    //           lineBeginIdxMap.set(rraw.length, this._idx)
    //           this._idx = arrowsPattern.lastIndex

    //           if (arrowNum === arrowNumNow) {
    //             rraw += arrowsPatternResult[2]
    //           } else if (arrowNum < arrowNumNow) {
    //             arrowNumNow = arrowNum
    //             sameArrowNumBefore.push(rraw.length)
    //             rraw += arrowsPatternResult[2]
    //           } else {
    //             break
    //           }
    //         } else {
    //           throw new Error('should not go here')
    //         }
    //       }
    //       sameArrowNumBefore.push(rraw.length)

    //       lineBeginIdxMap.set(rraw.length, this._idx)
    //       sameArrowNumBefore.push(rraw.length)

    //       let sidx = sameArrowNumBefore.length - 1
    //       const firstSameArrowNumBefore = sameArrowNumBefore[0]
    //       let shouldReturn = false

    //       const ilexer = new Lexer(rraw)
    //       while (true) {
    //         const oldIdx = ilexer._idx
    //         if (ilexer._idx < firstSameArrowNumBefore) {
    //           let block = ilexer.nextBlock()
    //           if (!block) break
    //           if (ilexer._idx <= firstSameArrowNumBefore) {
    //             list.append(block)
    //             while (sameArrowNumBefore[0] < ilexer._idx) {
    //               sameArrowNumBefore.shift()
    //             }
    //           } else {
    //             if (block.type === NodeType.PARAGRAPH) {
    //               list.append(block)

    //               //@ts-ignore
    //               this._idx = lineBeginIdxMap.get(ilexer._idx)
    //               shouldReturn = true

    //               break
    //             } else {
    //               // rollback
    //               while (sidx > 0 && sameArrowNumBefore[sidx] >= ilexer._idx) {
    //                 sidx--
    //               }
    //               ilexer._idx = oldIdx
    //               ilexer._raw = ilexer._raw.slice(0, sameArrowNumBefore[sidx])

    //               // @ts-ignore
    //               this._idx = lineBeginIdxMap.get(sameArrowNumBefore[sidx])

    //               shouldReturn = true
    //             }
    //           }
    //         } else {
    //           break
    //         }
    //       }

    //       if (shouldReturn) {
    //         const arrowsBeginPattern = /(?:> ?)*/y
    //         arrowsBeginPattern.lastIndex = this._idx
    //         const arrowsBeginPatternResult = arrowsBeginPattern.exec(raw)
    //         if (arrowsBeginPatternResult) {
    //           this._idx += arrowsBeginPatternResult[0].length
    //           const arrowNum =  arrowsBeginPatternResult[0].replace(/ /g, '').length
    //           return {
    //             children: list,
    //             depthBackTo: arrowNum - 1
    //           }
    //         } else {
    //           throw new Error('should not go here')
    //         }
            
    //       }
    //     }
    //   }
    // }
    // return {
    //   children: list,
    //   depthBackTo: depth - 1
    // }
  // }
  
}
