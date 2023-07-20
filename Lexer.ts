import { DoublyLinkedList } from "./DoublyLinkedList"
import { atxTypes, Node, NodeType } from "./Node"

interface ParaQueueItem extends Range {
  raw: string
}

export class Lexer {
  _raw: string
  _blocks: DoublyLinkedList<Node>
  _idx: number

  // A line containing no characters, or a line containing only spaces (U+0020) or tabs (U+0009), is called a blank line.
  _blankLinePattern = /[ \t]*(?:\n|$)/y
  _paragraphPattern = /.*(?:\n|$)/y
  _identedCodePattern = /     ?.*(?:\n|$)/y

  // _paraQueue: ParaQueueItem[]
  _lastBlock: Node | null = null

  _cachedBlock: {
    idx: number,
    blk: Node | null
  } | null = null

  constructor(raw: string) {
    this._idx = 0
    this._raw = raw
    this._blocks = new DoublyLinkedList()
  }

  nextBlock(): Node | null {
    let block: Node | null = null
    if (this._cachedBlock) {
      // console.log('cached')
      this._idx = this._cachedBlock.idx
      block = this._cachedBlock.blk
      this._cachedBlock = null
    } else {
      block = this._nextBlock()
    }
    this._lastBlock = block
    return block
  }

  _nextBlock(): Node | null {
    const { 
      _raw: raw,
      _identedCodePattern: identedCodePattern
    } = this
    // console.log(this._idx, raw.length)
    let hasBlankLines = false

    // skip blank lines
    this._blankLinePattern.lastIndex = this._idx
    while (this._idx < raw.length && this._blankLinePattern.test(raw)) {
      this._idx = this._blankLinePattern.lastIndex
      hasBlankLines = true
    }

    const oldIdx = this._idx
    while (this._idx < raw.length && raw.charAt(this._idx) === ' ') {
      this._idx++
    }
    const indentationNum = this._idx - oldIdx

    if (this._idx >= raw.length) {
      // TODO
      return null
    }
    if (indentationNum <= 3) {

      const firstChar = raw.charAt(this._idx)

      // atx heading
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
          // TODO: _idx
          return {
            type: NodeType.CODE_FENCE_BLOCK,
            raw: craw,
            children: null
          }
        }
      }

      // blockquotes
      if (firstChar === '>') {
        const { children } = this.parseBlockquote(0)
        const startIdx = this._idx
        return {
          type: NodeType.BLOCKQUOTE,
          raw: this._raw.slice(startIdx, this._idx),
          children
        }
      }

      // TODO: list items



      // setext headings
      // setext heading raw includes underline(- or =)
      if (this._lastBlock?.type === NodeType.POTENTIAL_PARAGRAPH && !hasBlankLines) {
        const setextHeadingPattern = /([=-])\1*[ \t]*(?:\n|$)/y
        setextHeadingPattern.lastIndex = this._idx
        const patternResult = setextHeadingPattern.exec(raw)
        if (patternResult) {
          if (patternResult[1] === '=') {
            this._lastBlock.type = NodeType.SETEXT_H1
          } else {
            this._lastBlock.type = NodeType.SETEXT_H2
          }
          this._lastBlock.raw += patternResult[0]
          this._idx = setextHeadingPattern.lastIndex
          return this._nextBlock()
        }
      }

      // thematic break
      if (['_', '*', '-'].includes(firstChar)) {
        
        const thematicBreakPattern = new RegExp(`(?:\\${firstChar}[\t ]*){3,}(?:\n|$)`, 'y')

        thematicBreakPattern.lastIndex = this._idx
        if (thematicBreakPattern.test(raw)) {
          this._idx = thematicBreakPattern.lastIndex
          const traw = raw.slice(this._idx, thematicBreakPattern.lastIndex)
          return {
            type: NodeType.THEMATIC_BREAK,
            raw: traw,
            children: null
          } 
        }
      }


      // paragraph
      return this.parseParagraph(hasBlankLines)

    } else {
      // idented code blocks
      
      if (!hasBlankLines && this._lastBlock?.type === NodeType.POTENTIAL_PARAGRAPH) {
        this._idx -= indentationNum
        return this.parseParagraph(hasBlankLines)
      }

      this._idx -= indentationNum
      let craw = ""

      let backIdx = this._idx

      const blankLinePattern = new RegExp(this._blankLinePattern)

      while (true) {
        let hasContent = false
        this._identedCodePattern.lastIndex = this._idx
        let startIdx = this._idx
        while (this._identedCodePattern.test(raw)) {
          hasContent = true
          craw += raw.slice(startIdx + 4, this._identedCodePattern.lastIndex)
          this._idx = this._identedCodePattern.lastIndex
          startIdx = this._idx
        }
        if (hasContent) {
          backIdx = this._idx
          blankLinePattern.lastIndex = this._idx
          while (this._idx < raw.length && blankLinePattern.test(raw)) {
            craw += '\n'
            this._idx = blankLinePattern.lastIndex
          }
        } else {
          this._idx = backIdx
          break
        }
      }
      
      return {
        type: NodeType.IDENTED_CODE_BLOCK,
        raw: craw, // indented code block raw is excluded of leading 4 spaces,
        children: null
      }
    }

  }

  parseParagraph(hasBlankLines: boolean) {
    const { _raw: raw } = this
    this._paragraphPattern.lastIndex = this._idx
    const result = this._paragraphPattern.exec(raw)
    // @ts-ignore
    const praw = result[0]
    if (this._lastBlock?.type === NodeType.POTENTIAL_PARAGRAPH && !hasBlankLines) {
      this._idx = this._paragraphPattern.lastIndex
      this._lastBlock.raw += praw
      return this._nextBlock()
    } else {
      const blk = {
        type: NodeType.POTENTIAL_PARAGRAPH,
        raw: praw,
        children: null
      }
      this._lastBlock = blk
      const currIdx = this._idx 
      this._idx = this._paragraphPattern.lastIndex
      this._cachedBlock = {
        blk: this._nextBlock(),
        idx: this._idx 
      }

      this._idx = currIdx + blk.raw.length

      if (blk.type === NodeType.POTENTIAL_PARAGRAPH) {
        blk.type = NodeType.PARAGRAPH
      }
      // console.log(JSON.stringify(raw.slice(currIdx, currIdx + blk.raw.length)))
      return blk
    }  
  }

  parseBlockquote(depth: number): {
    children: DoublyLinkedList<Node>,
    depthBackTo: number 
  } {
    const { _raw: raw } = this
    const list = new DoublyLinkedList<Node>()
    const blockquotePattern = /(> ?)(.*(?:\n|$))/y

    while (this._idx < raw.length) {
      blockquotePattern.lastIndex = this._idx
      const blockquotePatternResult = blockquotePattern.exec(raw)
      if (blockquotePatternResult) {
        const iraw = blockquotePatternResult[2]

        this._idx += blockquotePatternResult[1].length
        

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

          let rraw = blockquotePatternResult[2]
          this._idx = blockquotePattern.lastIndex

          const arrowsPattern = / {0,3}(((?:> ?)*)(.*(?:\n|$)))/y
          let arrowNumNow = depth + 1

          const sameArrowNumBefore: number[] = []
          const lineBeginIdxMap = new Map<number, number>()

          while (this._idx < raw.length) {
            arrowsPattern.lastIndex = this._idx
            lineBeginIdxMap.set(rraw.length, this._idx)
            const arrowsPatternResult = arrowsPattern.exec(raw)
            this._idx = arrowsPattern.lastIndex


            if (arrowsPatternResult) {
              const arrowNum = arrowsPatternResult[2].replace(/ /g, '').length

              lineBeginIdxMap.set(rraw.length, this._idx)
              this._idx = arrowsPattern.lastIndex

              if (arrowNum === arrowNumNow) {
                rraw += arrowsPatternResult[3]
              } else if (arrowNum < arrowNumNow) {
                arrowNumNow = arrowNum
                sameArrowNumBefore.push(rraw.length)
                rraw += arrowsPatternResult[3]
              } else {
                break
              }
            } else {
              throw new Error('should not go here')
            }
          }
          sameArrowNumBefore.push(rraw.length)

          lineBeginIdxMap.set(rraw.length, this._idx)
          sameArrowNumBefore.push(rraw.length)

          let sidx = sameArrowNumBefore.length - 1
          const firstSameArrowNumBefore = sameArrowNumBefore[0]
          let shouldReturn = false

          console.log(JSON.stringify(rraw))

          const ilexer = new Lexer(rraw)
          while (true) {
            const oldIdx = ilexer._idx
            if (ilexer._idx < firstSameArrowNumBefore) {
              let block = ilexer.nextBlock()
              if (!block) break
              if (ilexer._idx <= firstSameArrowNumBefore) {
                list.append(block)
                while (sameArrowNumBefore[0] < ilexer._idx) {
                  sameArrowNumBefore.shift()
                }
              } else {
                if (block.type === NodeType.PARAGRAPH) {
                  list.append(block)
                  //@ts-ignore
                  this._idx = lineBeginIdxMap.get(ilexer._idx)
                  shouldReturn = true

                  break
                } else {
                  // rollback
                  while (sidx > 0 && sameArrowNumBefore[sidx] >= ilexer._idx) {
                    sidx--
                  }
                  ilexer._idx = oldIdx
                  ilexer._raw = ilexer._raw.slice(0, sameArrowNumBefore[sidx])

                  // @ts-ignore
                  this._idx = lineBeginIdxMap.get(sameArrowNumBefore[sidx])

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
              this._idx += arrowsBeginPatternResult[0].length
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
      } else {
        throw new Error('should not go here')
      }
    }
    return {
      children: list,
      depthBackTo: depth - 1
    }
  }
  
}
